import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import prisma from './db';
import { redisConnectionOptions, default as redis } from './redis';
import { emailQueue, emailWorker, enqueueEmailJob, cancelEmailJob } from './queue';
import { initElasticsearch, searchEmailsInIndex, indexEmail, deleteEmailFromIndex } from './elasticsearch';
import { 
  authMiddleware, 
  verifyGoogleToken, 
  generateToken, 
  getGoogleAuthUrl, 
  handleGoogleCallback, 
  AuthenticatedRequest 
} from './auth';
import { getSlackAuthUrl, handleSlackCallback, sendSlackAlert } from './slack';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

import { ReachInboxQueueAdapter } from './queueAdapter';

// Set up Bull Board Admin Panel
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
try {
  createBullBoard({
    queues: [new ReachInboxQueueAdapter(emailQueue as any) as any],
    serverAdapter: serverAdapter,
  });
} catch (err) {
  console.warn('Bull board registration warning:', err);
}

app.use('/admin/queues', (req, res, next) => {
  try {
    return serverAdapter.getRouter()(req, res, next);
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(200).json({
        status: 'Active',
        engine: 'ReachInbox Queue Engine',
        message: 'Queue processor is active and executing background tasks.',
      });
    }
  }
});

/**
 * Startup Reconciliation Task (Scenario C Recovery)
 * Syncs any pending/queued jobs in the DB that are missing from Redis back into the queue
 */
async function reconcileOnBoot() {
  console.log('🔄 Running boot reconciliation job...');
  try {
    const pendingEmails = await prisma.emailJob.findMany({
      where: {
        status: { in: ['pending', 'queued', 'rate_limited'] },
      },
    });

    console.log(`🔍 Found ${pendingEmails.length} emails in DB with pending/queued/rate_limited status.`);
    
    let reQueuedCount = 0;
    for (const email of pendingEmails) {
      try {
        const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());
        const jobId = await enqueueEmailJob(email.id, delay);
        await prisma.emailJob.update({
          where: { id: email.id },
          data: { status: 'queued', bullJobId: jobId },
        });
        reQueuedCount++;
      } catch (e) {
        console.warn(`Could not re-queue job ${email.id}:`, e);
      }
    }
    console.log(`✅ Boot reconciliation complete. Re-queued ${reQueuedCount} missing jobs.`);
  } catch (error) {
    console.error('❌ Failed to run boot reconciliation:', error);
  }
}

// ==========================================
// AUTHENTICATION API ROUTES
// ==========================================

/**
 * Initiate Google OAuth2 Login Flow
 * Redirects the user's browser directly to Google's consent screen
 */
app.get('/api/auth/google', (req, res) => {
  try {
    const authUrl = getGoogleAuthUrl();
    res.redirect(authUrl);
  } catch (err: any) {
    console.error('Failed to generate Google auth URL:', err?.message);
    res.status(400).json({ error: err?.message || 'Google OAuth is not configured' });
  }
});

/**
 * Returns the Google OAuth consent URL in JSON format for client-side redirection
 */
app.get('/api/auth/google/url', (req, res) => {
  try {
    const url = getGoogleAuthUrl();
    res.json({ url });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Google OAuth is not configured' });
  }
});

/**
 * Google OAuth2 Callback Route
 * Receives the authorization code from Google, exchanges it for user credentials,
 * upserts the account in PostgreSQL, and redirects to frontend with a valid JWT token.
 */
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('Google OAuth error from query param:', error);
    return res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(String(error))}`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent('No authorization code returned from Google')}`);
  }

  try {
    const { token } = await handleGoogleCallback(String(code));
    // Redirect back to frontend dashboard with session token in query string
    res.redirect(`${FRONTEND_URL}/?token=${token}&login=google_success`);
  } catch (err: any) {
    console.error('Google OAuth callback failed:', err?.message || err);
    res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(err?.message || 'Google authentication failed')}`);
  }
});

/**
 * Verify Google OAuth ID Token (for direct popup/GIS responses)
 */
app.post('/api/auth/google/verify', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'idToken is required' });
  }

  try {
    const result = await verifyGoogleToken(idToken);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Google Authentication failed' });
  }
});

/**
 * Developer Bypass Login Route for testing without Google Credentials
 */
app.post('/api/auth/test-login', async (req, res) => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: name || 'Test User' },
      create: {
        email,
        name: name || 'Test User',
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      },
    });

    const token = generateToken(user);
    res.json({ token, user });
  } catch (error: any) {
    res.status(500).json({ error: 'Bypass login failed' });
  }
});

/**
 * Get Authenticated User Details
 */
app.get('/api/auth/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      include: { slackIntegration: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

// ==========================================
// SENDERS API ROUTES
// ==========================================

/**
 * Get Senders Configured by the User
 */
app.get('/api/senders', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const senders = await prisma.sender.findMany({
      where: { userId: req.user?.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(senders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch senders' });
  }
});

/**
 * Configure a New Sender (SMTP Credentials)
 * Generates Ethereal credentials dynamically if user requests auto-generation
 */
app.post('/api/senders', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { name, email, smtpHost, smtpPort, smtpUser, smtpPass, hourlyLimit, generateEthereal } = req.body;

  if (!name || (!generateEthereal && (!email || !smtpHost || !smtpPort || !smtpUser || !smtpPass))) {
    return res.status(400).json({ error: 'Missing required configuration parameters' });
  }

  try {
    let finalEmail = email;
    let finalHost = smtpHost;
    let finalPort = smtpPort ? parseInt(smtpPort, 10) : 587;
    let finalUser = smtpUser;
    let finalPass = smtpPass;

    // Auto-generate test account if requested
    if (generateEthereal) {
      console.log('Generating Ethereal SMTP test account...');
      const testAccount = await nodemailer.createTestAccount();
      finalEmail = testAccount.user;
      finalHost = testAccount.smtp.host;
      finalPort = testAccount.smtp.port;
      finalUser = testAccount.user;
      finalPass = testAccount.pass;
      console.log(`Generated Ethereal User: ${finalUser}`);
    }

    const sender = await prisma.sender.upsert({
      where: { email: finalEmail },
      update: {
        userId: req.user!.id,
        name,
        displayName: name,
        smtpHost: finalHost,
        smtpPort: finalPort,
        smtpUser: finalUser,
        smtpPass: finalPass,
        maxEmailsPerHour: hourlyLimit ? parseInt(hourlyLimit, 10) : 200,
      },
      create: {
        userId: req.user!.id,
        name,
        displayName: name,
        email: finalEmail,
        smtpHost: finalHost,
        smtpPort: finalPort,
        smtpUser: finalUser,
        smtpPass: finalPass,
        maxEmailsPerHour: hourlyLimit ? parseInt(hourlyLimit, 10) : 200,
      },
    });

    res.status(201).json(sender);
  } catch (error: any) {
    console.error('Failed to create sender:', error);
    res.status(500).json({ error: error.message || 'Failed to create sender' });
  }
});

// ==========================================
// EMAIL SCHEDULER API ROUTES
// ==========================================

/**
 * Schedule New Emails Batch (CSV or manual)
 */
app.post('/api/emails/schedule', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { senderId, subject, body, recipients, startTime, delaySeconds } = req.body;

  if (!senderId || !subject || !body || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Missing required fields for scheduling' });
  }

  try {
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
    });

    if (!sender || sender.userId !== req.user?.id) {
      return res.status(404).json({ error: 'Sender not found or unauthorized' });
    }

    const startTimestamp = startTime ? new Date(startTime).getTime() : Date.now();
    const intervalSeconds = delaySeconds ? parseInt(delaySeconds, 10) : 2;
    const batchId = crypto.randomUUID ? crypto.randomUUID() : new Date().getTime().toString();

    console.log(`Scheduling ${recipients.length} emails. Starting at ${new Date(startTimestamp).toISOString()} with ${intervalSeconds}s spacing.`);

    const emailJobsData = [];
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const scheduledTime = new Date(startTimestamp + i * intervalSeconds * 1000);

      // Write to Database first (Scenario C safeguard)
      const emailJob = await prisma.emailJob.create({
        data: {
          userId: req.user!.id,
          senderId: sender.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name || '',
          subject,
          body,
          scheduledAt: scheduledTime,
          batchId,
          status: 'pending',
        },
      });

      // Calculate delayed delivery offset
      const delayMs = Math.max(0, scheduledTime.getTime() - Date.now());

      // Add delayed job to queue
      const jobId = await enqueueEmailJob(emailJob.id, delayMs);

      // Update email job with status = queued
      const updatedJob = await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: {
          status: 'queued',
          bullJobId: jobId,
        },
      });

      // Pre-index email in Elasticsearch as queued
      await indexEmail(updatedJob, sender);
      emailJobsData.push(updatedJob);
    }

    res.status(202).json({
      message: `Successfully scheduled ${recipients.length} emails.`,
      batchId,
      count: recipients.length,
    });

  } catch (error: any) {
    console.error('Failed to schedule emails batch:', error);
    res.status(500).json({ error: error.message || 'Failed to schedule emails batch' });
  }
});

/**
 * Retrieve Emails by status (Scheduled / Sent / Failed)
 */
app.get('/api/emails', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { status, page = '1', limit = '10' } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  try {
    let whereClause: any = { userId: req.user!.id };

    if (status === 'scheduled') {
      whereClause.status = { in: ['pending', 'queued', 'sending', 'rate_limited'] };
    } else if (status === 'sent') {
      whereClause.status = 'sent';
    } else if (status === 'failed') {
      whereClause.status = 'failed';
    }

    const [emails, total] = await prisma.$transaction([
      prisma.emailJob.findMany({
        where: whereClause,
        include: { sender: true },
        orderBy: { scheduledAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.emailJob.count({ where: whereClause }),
    ]);

    res.json({
      emails,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

/**
 * Search emails using Elasticsearch (full-text index search) with DB fallback
 */
app.get('/api/emails/search', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { q, status } = req.query;
  if (q === undefined) {
    return res.status(400).json({ error: 'Search query parameter q is required' });
  }

  try {
    let results = await searchEmailsInIndex(
      req.user!.id,
      q as string,
      status as string || undefined
    );

    if (!results || results.length === 0) {
      const queryStr = String(q).toLowerCase();
      let whereClause: any = {
        userId: req.user!.id,
        OR: [
          { subject: { contains: queryStr } },
          { body: { contains: queryStr } },
          { recipientEmail: { contains: queryStr } },
          { recipientName: { contains: queryStr } },
        ],
      };

      if (status === 'scheduled') {
        whereClause.status = { in: ['pending', 'queued', 'sending', 'rate_limited'] };
      } else if (status === 'sent') {
        whereClause.status = 'sent';
      } else if (status === 'failed') {
        whereClause.status = 'failed';
      }

      const dbEmails = await prisma.emailJob.findMany({
        where: whereClause,
        include: { sender: true },
        orderBy: { scheduledAt: 'desc' },
      });

      results = dbEmails.map((e) => ({
        id: e.id,
        recipient: e.recipientEmail,
        recipientEmail: e.recipientEmail,
        recipientName: e.recipientName,
        subject: e.subject,
        body: e.body,
        status: e.status,
        scheduledAt: e.scheduledAt,
        sentAt: e.sentAt,
        senderEmail: e.sender?.email,
        senderName: e.sender?.name,
      }));
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Elasticsearch search failed' });
  }
});

/**
 * Get Specific Email Details (Read)
 */
app.get('/api/emails/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  try {
    const email = await prisma.emailJob.findFirst({
      where: { id, userId: req.user!.id },
      include: { sender: true },
    });

    if (!email) {
      return res.status(404).json({ error: 'Email record not found' });
    }

    res.json(email);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch email details' });
  }
});

/**
 * Update / Edit Scheduled Email (Update)
 */
app.put('/api/emails/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { recipientEmail, recipientName, subject, body, scheduledAt, senderId } = req.body;

  try {
    const existing = await prisma.emailJob.findFirst({
      where: { id, userId: req.user!.id },
      include: { sender: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Email record not found' });
    }

    if (existing.status === 'sent') {
      return res.status(400).json({ error: 'Cannot modify an email that has already been sent.' });
    }

    let updatedSenderId = existing.senderId;
    if (senderId && senderId !== existing.senderId) {
      const sender = await prisma.sender.findFirst({
        where: { id: senderId, userId: req.user!.id },
      });
      if (sender) {
        updatedSenderId = sender.id;
      }
    }

    const newScheduledAt = scheduledAt ? new Date(scheduledAt) : existing.scheduledAt;

    // If time or status changed, cancel current job timer and reschedule
    await cancelEmailJob(id);

    const delayMs = Math.max(0, newScheduledAt.getTime() - Date.now());
    const newJobId = await enqueueEmailJob(id, delayMs);

    const updated = await prisma.emailJob.update({
      where: { id },
      data: {
        recipientEmail: recipientEmail ? recipientEmail.trim() : existing.recipientEmail,
        recipientName: recipientName !== undefined ? recipientName.trim() : existing.recipientName,
        subject: subject !== undefined ? subject : existing.subject,
        body: body !== undefined ? body : existing.body,
        scheduledAt: newScheduledAt,
        senderId: updatedSenderId,
        status: 'queued',
        bullJobId: newJobId,
      },
      include: { sender: true },
    });

    // Update Elasticsearch
    await indexEmail(updated, updated.sender);

    res.json({
      message: 'Scheduled email successfully updated and rescheduled.',
      email: updated,
    });
  } catch (error: any) {
    console.error(`Failed to update email ${id}:`, error);
    res.status(500).json({ error: error.message || 'Failed to update scheduled email' });
  }
});

/**
 * Cancel and Delete Scheduled Email (Delete)
 */
app.delete('/api/emails/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.emailJob.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Email record not found' });
    }

    // Cancel active queue job/timer
    await cancelEmailJob(id);

    // Delete from Database
    await prisma.emailJob.delete({
      where: { id },
    });

    // Delete from Elasticsearch
    await deleteEmailFromIndex(id);

    res.json({
      message: 'Email successfully cancelled and removed from queue.',
      id,
    });
  } catch (error: any) {
    console.error(`Failed to delete email ${id}:`, error);
    res.status(500).json({ error: error.message || 'Failed to delete email' });
  }
});

/**
 * Batch Cancel and Delete Scheduled Emails
 */
app.post('/api/emails/batch-delete', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }

  try {
    const emails = await prisma.emailJob.findMany({
      where: {
        id: { in: ids },
        userId: req.user!.id,
      },
    });

    for (const email of emails) {
      await cancelEmailJob(email.id);
      await deleteEmailFromIndex(email.id);
    }

    await prisma.emailJob.deleteMany({
      where: {
        id: { in: emails.map((e) => e.id) },
      },
    });

    res.json({
      message: `Successfully cancelled and deleted ${emails.length} emails.`,
      deletedCount: emails.length,
    });
  } catch (error: any) {
    console.error('Failed to batch delete emails:', error);
    res.status(500).json({ error: error.message || 'Failed to batch delete emails' });
  }
});

/**
 * Get Email Status Counts for Sidebar Widgets
 */
app.get('/api/emails/counts', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const scheduled = await prisma.emailJob.count({
      where: {
        userId: req.user!.id,
        status: { in: ['pending', 'queued', 'sending', 'rate_limited'] },
      },
    });

    const sent = await prisma.emailJob.count({
      where: {
        userId: req.user!.id,
        status: 'sent',
      },
    });

    const failed = await prisma.emailJob.count({
      where: {
        userId: req.user!.id,
        status: 'failed',
      },
    });

    res.json({ scheduled, sent, failed });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve email counts' });
  }
});

// ==========================================
// SLACK INTEGRATION API ROUTES
// ==========================================

/**
 * Connect Slack - Generates redirect URL
 */
app.get('/api/slack/connect', authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    const url = getSlackAuthUrl(req.user!.id);
    res.json({ url });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Slack integration is not configured' });
  }
});

/**
 * Slack Redirect Callback OAuth Route
 */
app.get('/api/slack/callback', async (req, res) => {
  const { code, state: userId } = req.query;

  if (!code || !userId) {
    return res.status(400).send('OAuth failed: missing code or user identifier state');
  }

  try {
    await handleSlackCallback(code as string, userId as string);
    // Redirect user back to dashboard settings page
    res.redirect(`${FRONTEND_URL}/dashboard?slack=success`);
  } catch (error: any) {
    console.error('Slack OAuth error:', error);
    res.redirect(`${FRONTEND_URL}/dashboard?slack=error&message=${encodeURIComponent(error.message || 'OAuth verification failed')}`);
  }
});

/**
 * Disconnect Slack Integration
 */
app.post('/api/slack/disconnect', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    await prisma.slackIntegration.delete({
      where: { userId: req.user!.id },
    });
    res.json({ message: 'Slack integration disconnected successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
});

// ==========================================
// APP STARTUP
// ==========================================

app.listen(PORT, async () => {
  console.log(`🚀 Express server running on http://localhost:${PORT}`);
  console.log(`📊 Bull Board Queue dashboard mounted at http://localhost:${PORT}/admin/queues`);
  
  // 1. Initialize Elasticsearch indexes
  await initElasticsearch();

  // 2. Run Boot Reconciliation Sync
  await reconcileOnBoot();
});
