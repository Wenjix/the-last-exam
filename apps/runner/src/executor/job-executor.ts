import { randomUUID } from 'node:crypto';
import type { RunnerResult } from '@tle/contracts';
import type { JobQueue, QueuedJob } from '../queue/index.js';
import type { CallbackClient } from '../callback/index.js';

// === Configuration ===

export interface JobExecutorConfig {
  /** Poll interval in ms (default: 1000) */
  pollIntervalMs?: number;
}

// === Job Executor ===

/**
 * Polls the job queue for pending jobs, processes them, and reports
 * results back to the server via the CallbackClient.
 *
 * Job processing is currently a placeholder (mock result) -- real
 * sandbox execution will be implemented in 549.3/549.4.
 */
export class JobExecutor {
  private readonly queue: JobQueue;
  private readonly callbackClient: CallbackClient;
  private readonly pollIntervalMs: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  constructor(queue: JobQueue, callbackClient: CallbackClient, config?: JobExecutorConfig) {
    this.queue = queue;
    this.callbackClient = callbackClient;
    this.pollIntervalMs = config?.pollIntervalMs ?? 1000;
  }

  /** Start polling the queue for jobs. */
  start(): void {
    if (this.timerId !== null) {
      return; // Already running
    }

    console.log(`[job-executor] Started polling (interval: ${this.pollIntervalMs}ms)`);

    this.timerId = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);

    // Run an immediate poll on start
    void this.poll();
  }

  /** Stop polling the queue. */
  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
      console.log('[job-executor] Stopped polling');
    }
  }

  /** Whether the executor is currently running. */
  get running(): boolean {
    return this.timerId !== null;
  }

  /**
   * Single poll iteration: dequeue a job, process it, and deliver the result.
   * Serialized -- if a previous poll is still processing, skip this tick.
   */
  private async poll(): Promise<void> {
    if (this.processing) {
      return;
    }

    const job = this.queue.dequeue();
    if (!job) {
      return;
    }

    this.processing = true;
    try {
      await this.executeAndReport(job);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Execute a job and report the result via callback.
   * On callback success: mark the job completed.
   * On callback failure: mark the job failed.
   */
  private async executeAndReport(queuedJob: QueuedJob): Promise<void> {
    console.log(`[job-executor] Processing job ${queuedJob.id}`);

    const result = this.processJob(queuedJob);
    const delivered = await this.callbackClient.sendResult(result);

    if (delivered) {
      this.queue.markCompleted(queuedJob.id);
      console.log(`[job-executor] Job ${queuedJob.id} completed and result delivered`);
    } else {
      this.queue.markFailed(queuedJob.id);
      console.error(`[job-executor] Job ${queuedJob.id} failed -- callback delivery unsuccessful`);
    }
  }

  /**
   * Process a job and produce a RunnerResult.
   *
   * PLACEHOLDER: Returns a mock success result. Real sandbox execution
   * will be implemented in issues 549.3 and 549.4.
   */
  private processJob(queuedJob: QueuedJob): RunnerResult {
    const { job } = queuedJob;

    const result: RunnerResult = {
      jobId: job.jobId,
      matchId: job.matchId,
      agentId: job.agentId,
      round: job.round,
      success: true,
      stdout: '[placeholder] Mock execution output',
      stderr: '',
      submittedCode: '// placeholder -- no code executed yet',
      harnessResults: [
        {
          testId: randomUUID(),
          passed: true,
          input: 'mock input',
          expectedOutput: 'mock output',
          actualOutput: 'mock output',
        },
      ],
      executionMetadata: {
        durationMs: 0,
        memoryUsedBytes: 0,
        cpuTimeMs: 0,
        exitCode: 0,
        timedOut: false,
        sandboxId: 'placeholder',
      },
      scoreBreakdown: {
        correctness: 1,
        baseScore: 100,
        totalScore: 100,
      },
    };

    return result;
  }
}
