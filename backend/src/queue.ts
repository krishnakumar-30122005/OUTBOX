import { Queue, Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import prisma from './db';
import redis, { isRedisConnected } from './redis';
import { indexEmail } from './elasticsearch';
import { sendSlackAlert } from './slack';
import dotenv from 'dotenv';

dotenv.config();

const QUEUE_NAME = 'email-queue';
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const MIN_SEND_DELAY_MS = parseInt(process.env.MIN_SEND_DELAY_MS || '2000', 10);

// In-memory rate limiting fallback for zero-dependency operation
const inMemoryRateLimits = new Map<string, { count: number; expiresAt: number }>();

function getInMemoryRateCount(key: string, limit: number): boolean {
  const now = Date.now();
  const current = inMemoryRateLimits.get(key);
  if (!current || current.expiresAt < now) {
    inMemoryRateLimits.set(key, { count: 1, expiresAt: now + 3600 * 1000 });
    return true; // allowed
  }
  if (current.count >= limit) {
    return false; // rate limited
  }
  current.count += 1;
  return true; // allowed
}

// Initialize BullMQ Queue
export const emailQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

function getMsUntilNextHour(): number {
  const now = Date.now();
  const nextHour = new Date();
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  return nextHour.getTime() - now + 1000;
}

function createTransporter(sender: { smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string }) {
  return nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpPort === 465,
    auth: {
      user: sender.smtpUser,
      pass: sender.smtpPass,
    },
  });
}

/**
 * Core Email Execution Logic (Used by both BullMQ Worker and In-Memory Queue)
 */
export async function executeEmailDelivery(emailId: string, attemptNumber = 1) {
  console.log(`[Email Engine] Processing EmailJob: ${emailId} (Attempt ${attemptNumber})`);

  const email = await prisma.emailJob.findUnique({
    where: { id: emailId },
    include: { sender: true },
  });

  if (!email) {
    console.warn(`[Email Engine] EmailJob ${emailId} not found. Skipping.`);
    return;
  }

  if (email.status === 'sent') {
    console.log(`[Email Engine] EmailJob ${emailId} is already 'sent'. Skipping.`);
    return;
  }

  await prisma.emailJob.update({
    where: { id: emailId },
    data: { status: 'sending' },
  });

  const { sender } = email;
  const hourWindow = new Date().toISOString().slice(0, 13).replace(/[-T]/g, '');
  const rateLimitKey = `rate:${sender.id}:${hourWindow}`;

  let isAllowed = true;
  if (isRedisConnected) {
    try {
      const currentCount = await redis.incr(rateLimitKey);
      if (currentCount === 1) {
        await redis.expire(rateLimitKey, 3600);
      }
      if (currentCount > sender.maxEmailsPerHour) {
        await redis.decr(rateLimitKey);
        isAllowed = false;
      }
    } catch {
      isAllowed = getInMemoryRateCount(rateLimitKey, sender.maxEmailsPerHour);
    }
  } else {
    isAllowed = getInMemoryRateCount(rateLimitKey, sender.maxEmailsPerHour);
  }

  if (!isAllowed) {
    await prisma.emailJob.update({
      where: { id: emailId },
      data: { status: 'rate_limited' },
    });

    const delayMs = getMsUntilNextHour();
    console.log(`[Rate Limit] Sender ${sender.email} reached max hourly limit. Rescheduling in ${delayMs}ms.`);
    
    // Reschedule
    enqueueEmailJob(emailId, delayMs);

    try {
      await sendSlackAlert(
        sender.userId,
        `🚨 *Rate Limit Alert*: Sender \`${sender.email}\` hit max limit (${sender.maxEmailsPerHour}/hr). Rescheduling emails.`
      );
    } catch {}
    return;
  }

  try {
    const transporter = createTransporter(sender);
    const info = await transporter.sendMail({
      from: `"${sender.displayName}" <${sender.email}>`,
      to: email.recipientEmail,
      subject: email.subject,
      html: email.body,
    });

    console.log(`✔ [Email Engine] Email successfully delivered to ${email.recipientEmail} (ID: ${info.messageId})`);
    if (sender.smtpHost.includes('ethereal.email')) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`✉️ [Ethereal Preview URL]: ${previewUrl}`);
    }

    const updatedEmail = await prisma.emailJob.update({
      where: { id: emailId },
      data: {
        status: 'sent',
        sentAt: new Date(),
        attempts: attemptNumber,
      },
    });

    await indexEmail(updatedEmail, sender);
  } catch (error: any) {
    console.error(`✖ [Email Engine] Error sending email ${emailId}:`, error.message || error);

    const isLastAttempt = attemptNumber >= 3;
    const updatedEmail = await prisma.emailJob.update({
      where: { id: emailId },
      data: {
        status: isLastAttempt ? 'failed' : 'pending',
        attempts: attemptNumber,
        lastError: error.message || String(error),
      },
    });

    if (isLastAttempt) {
      await indexEmail(updatedEmail, sender);
    } else {
      // Retry in 5s
      setTimeout(() => {
        executeEmailDelivery(emailId, attemptNumber + 1);
      }, 5000);
    }
  }
}

/**
 * Universal Job Enqueuer (Routes to BullMQ if Redis connected, or local timer queue)
 */
export async function enqueueEmailJob(emailId: string, delayMs: number): Promise<string> {
  if (isRedisConnected) {
    try {
      const job = await emailQueue.add(
        'send-email',
        { emailId },
        {
          jobId: emailId,
          delay: delayMs,
        }
      );
      return job.id || emailId;
    } catch (err) {
      console.warn('BullMQ enqueue failed, using local queue fallback:', err);
    }
  }

  // Local fallback queue with precision timer
  setTimeout(() => {
    executeEmailDelivery(emailId, 1);
  }, Math.max(0, delayMs));

  return `local-${emailId}`;
}

// BullMQ Worker
export const emailWorker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    await executeEmailDelivery(job.data.emailId, job.attemptsMade + 1);
  },
  {
    connection: redis,
    concurrency: WORKER_CONCURRENCY,
    limiter: {
      max: 1,
      duration: MIN_SEND_DELAY_MS,
    },
  }
);

emailQueue.on('error', (err: any) => {
  // Prevent unhandled error event when Redis is reconnecting
});

emailWorker.on('completed', (job) => {
  console.log(`[BullMQ Worker] Job ${job.id} completed.`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[BullMQ Worker] Job ${job?.id} failed:`, err.message);
});

emailWorker.on('error', (err: any) => {
  // Prevent unhandled error event when Redis is reconnecting
});
