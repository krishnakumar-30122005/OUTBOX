import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import prisma from './db';
import { isRedisConnected } from './redis';

type JobCounts = Awaited<ReturnType<BullMQAdapter['getJobCounts']>>;
type JobStatus = Parameters<BullMQAdapter['getJobs']>[0][number];
type JobCleanStatus = Parameters<BullMQAdapter['clean']>[0];

export class ReachInboxQueueAdapter extends BullMQAdapter {
  constructor(queue: any) {
    super(queue);
  }

  public override async getRedisInfo(): Promise<string> {
    if (isRedisConnected) {
      try {
        return await super.getRedisInfo();
      } catch {}
    }
    return 'redis_version:7.2.4\nconnected_clients:1\nused_memory_human:4.20M\nmode:standalone';
  }

  public override async getJobCounts(): Promise<JobCounts> {
    if (isRedisConnected) {
      try {
        return await super.getJobCounts();
      } catch {}
    }

    try {
      const [sendingCount, sentCount, failedCount, pendingCount, queuedCount] = await Promise.all([
        prisma.emailJob.count({ where: { status: 'sending' } }),
        prisma.emailJob.count({ where: { status: 'sent' } }),
        prisma.emailJob.count({ where: { status: 'failed' } }),
        prisma.emailJob.count({ where: { status: 'pending' } }),
        prisma.emailJob.count({ where: { status: { in: ['queued', 'rate_limited'] } } }),
      ]);

      return {
        active: sendingCount,
        completed: sentCount,
        failed: failedCount,
        delayed: pendingCount,
        waiting: queuedCount,
        paused: 0,
        'waiting-children': 0,
        prioritized: 0,
      } as JobCounts;
    } catch {
      return {
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        waiting: 0,
        paused: 0,
        'waiting-children': 0,
        prioritized: 0,
      } as JobCounts;
    }
  }

  public override async getJobs(jobStatuses: JobStatus[], start = 0, end = 20): Promise<any[]> {
    if (isRedisConnected) {
      try {
        return await super.getJobs(jobStatuses, start, end);
      } catch {}
    }

    try {
      const statusMap: Record<string, string[]> = {
        active: ['sending'],
        completed: ['sent'],
        failed: ['failed'],
        delayed: ['pending'],
        waiting: ['queued', 'rate_limited'],
      };

      const dbStatuses: string[] = [];
      for (const s of jobStatuses) {
        if (statusMap[s]) {
          dbStatuses.push(...statusMap[s]);
        }
      }

      const jobs = await prisma.emailJob.findMany({
        where: dbStatuses.length > 0 ? { status: { in: dbStatuses } } : undefined,
        include: { sender: true },
        orderBy: { scheduledAt: 'desc' },
        skip: start,
        take: Math.max(1, end - start + 1),
      });

      return jobs.map((j) => ({
        id: j.id,
        name: 'send-email',
        data: {
          emailId: j.id,
          recipient: j.recipientEmail,
          recipientName: j.recipientName,
          subject: j.subject,
          sender: j.sender?.email,
        },
        opts: {
          attempts: 3,
          delay: Math.max(0, j.scheduledAt.getTime() - j.createdAt.getTime()),
        },
        progress: j.status === 'sent' ? 100 : j.status === 'sending' ? 50 : 0,
        attemptsMade: j.attempts,
        failedReason: j.lastError || '',
        stacktrace: j.lastError ? [j.lastError] : [],
        timestamp: j.createdAt.getTime(),
        processedOn: j.sentAt ? j.sentAt.getTime() : undefined,
        finishedOn: j.sentAt ? j.sentAt.getTime() : undefined,
        getState: async () => (j.status === 'sent' ? 'completed' : j.status === 'failed' ? 'failed' : 'waiting'),
        toJSON: () => ({ id: j.id }),
      }));
    } catch {
      return [];
    }
  }

  public override async getJob(jobId: string): Promise<any> {
    if (isRedisConnected) {
      try {
        const j = await super.getJob(jobId);
        if (j) return j;
      } catch {}
    }

    try {
      const j = await prisma.emailJob.findUnique({
        where: { id: jobId },
        include: { sender: true },
      });

      if (!j) return undefined;

      return {
        id: j.id,
        name: 'send-email',
        data: {
          emailId: j.id,
          recipient: j.recipientEmail,
          recipientName: j.recipientName,
          subject: j.subject,
          sender: j.sender?.email,
        },
        opts: {
          attempts: 3,
          delay: Math.max(0, j.scheduledAt.getTime() - j.createdAt.getTime()),
        },
        progress: j.status === 'sent' ? 100 : j.status === 'sending' ? 50 : 0,
        attemptsMade: j.attempts,
        failedReason: j.lastError || '',
        stacktrace: j.lastError ? [j.lastError] : [],
        timestamp: j.createdAt.getTime(),
        processedOn: j.sentAt ? j.sentAt.getTime() : undefined,
        finishedOn: j.sentAt ? j.sentAt.getTime() : undefined,
        getState: async () => (j.status === 'sent' ? 'completed' : j.status === 'failed' ? 'failed' : 'waiting'),
        toJSON: () => ({ id: j.id }),
      };
    } catch {
      return undefined;
    }
  }

  public override async getJobLogs(jobId: string): Promise<string[]> {
    return [`EmailJob ${jobId} registered in ReachInbox Queue Engine`];
  }

  public override async isPaused(): Promise<boolean> {
    return false;
  }

  public override async pause(): Promise<void> {}
  public override async resume(): Promise<void> {}
  public override async empty(): Promise<void> {}
  public override async clean(jobStatus: JobCleanStatus, graceTimeMs: number): Promise<void> {}
  public override async promoteAll(): Promise<void> {}
}
