import { Router } from 'express';
import { RunnerJobSchema } from '@tle/contracts';
import type { JobQueue } from '../queue/index.js';

export function createJobsRouter(queue: JobQueue): Router {
  const router = Router();

  // POST /jobs - Submit a runner job
  router.post('/jobs', (req, res) => {
    const parsed = RunnerJobSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_SCHEMA',
          message: 'Invalid runner job payload',
          details: parsed.error.issues,
        },
      });
      return;
    }

    const job = parsed.data;

    // Reject duplicate job IDs
    if (queue.getJob(job.jobId)) {
      res.status(409).json({
        error: {
          code: 'CONFLICT_DUPLICATE_JOB',
          message: `Job ${job.jobId} already exists`,
        },
      });
      return;
    }

    const jobId = queue.enqueue(job);

    res.status(202).json({
      jobId,
      status: 'queued',
      message: 'Job accepted for processing',
    });
  });

  // GET /jobs/:id - Query job status
  router.get('/jobs/:id', (req, res) => {
    const entry = queue.getJob(req.params.id);
    if (!entry) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Job ${req.params.id} not found`,
        },
      });
      return;
    }

    res.json({
      jobId: entry.id,
      status: entry.status,
      enqueuedAt: entry.enqueuedAt,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
    });
  });

  // GET /jobs - List queue stats
  router.get('/jobs', (_req, res) => {
    res.json({
      queued: queue.size,
      total: queue.totalTracked,
    });
  });

  return router;
}
