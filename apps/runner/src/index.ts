import express from 'express';
import cors from 'cors';
import { healthRouter, createJobsRouter } from './routes/index.js';
import { JobQueue } from './queue/index.js';
import { CallbackClient } from './callback/index.js';
import { JobExecutor } from './executor/index.js';

const PORT = parseInt(process.env.RUNNER_PORT || '3002', 10);
const SERVER_CALLBACK_URL =
  process.env.SERVER_CALLBACK_URL || 'http://localhost:3001/api/runner/callback';

// Shared job queue instance
const jobQueue = new JobQueue();

// Callback client for reporting results to the server
const callbackClient = new CallbackClient({
  serverUrl: SERVER_CALLBACK_URL,
});

// Job executor: polls queue, processes jobs, and delivers results
const jobExecutor = new JobExecutor(jobQueue, callbackClient);

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use(healthRouter);
app.use(createJobsRouter(jobQueue));

const server = app.listen(PORT, () => {
  console.log(`[tle-runner] listening on http://localhost:${PORT}`);
  console.log(`[tle-runner] callback target: ${SERVER_CALLBACK_URL}`);

  // Start processing jobs after server is ready
  jobExecutor.start();
});

// Graceful shutdown
function shutdown(): void {
  console.log('[tle-runner] Shutting down...');
  jobExecutor.stop();
  server.close(() => {
    console.log('[tle-runner] Server closed');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, server, jobQueue, callbackClient, jobExecutor };
