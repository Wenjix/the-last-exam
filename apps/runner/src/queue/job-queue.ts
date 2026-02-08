import type { RunnerJob } from '@tle/contracts';

// === Job Status ===

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

// === Queued Job Wrapper ===

export interface QueuedJob {
  id: string;
  status: JobStatus;
  job: RunnerJob;
  enqueuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

// === In-Memory Job Queue ===

export class JobQueue {
  private readonly jobs = new Map<string, QueuedJob>();
  private readonly queue: string[] = [];

  /**
   * Add a job to the queue. Uses the jobId from the RunnerJob payload.
   * Returns the job ID.
   */
  enqueue(job: RunnerJob): string {
    const queued: QueuedJob = {
      id: job.jobId,
      status: 'queued',
      job,
      enqueuedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };

    this.jobs.set(queued.id, queued);
    this.queue.push(queued.id);
    return queued.id;
  }

  /**
   * Take the next queued job for processing.
   * Moves the job status from 'queued' to 'processing'.
   */
  dequeue(): QueuedJob | undefined {
    while (this.queue.length > 0) {
      const id = this.queue.shift()!;
      const entry = this.jobs.get(id);
      if (entry && entry.status === 'queued') {
        entry.status = 'processing';
        entry.startedAt = new Date().toISOString();
        return entry;
      }
    }
    return undefined;
  }

  /** Lookup a job by ID. */
  getJob(id: string): QueuedJob | undefined {
    return this.jobs.get(id);
  }

  /** Get the status of a job by ID, or undefined if not found. */
  getStatus(id: string): JobStatus | undefined {
    return this.jobs.get(id)?.status;
  }

  /** Mark a processing job as completed. */
  markCompleted(id: string): void {
    const entry = this.jobs.get(id);
    if (entry && entry.status === 'processing') {
      entry.status = 'completed';
      entry.completedAt = new Date().toISOString();
    }
  }

  /** Mark a processing job as failed. */
  markFailed(id: string): void {
    const entry = this.jobs.get(id);
    if (entry && entry.status === 'processing') {
      entry.status = 'failed';
      entry.completedAt = new Date().toISOString();
    }
  }

  /** Number of jobs currently in 'queued' status. */
  get size(): number {
    return this.queue.filter((id) => this.jobs.get(id)?.status === 'queued').length;
  }

  /** Total number of jobs tracked (all statuses). */
  get totalTracked(): number {
    return this.jobs.size;
  }
}
