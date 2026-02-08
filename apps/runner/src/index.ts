import express from 'express';
import cors from 'cors';
import { healthRouter, createJobsRouter } from './routes/index.js';
import { JobQueue } from './queue/index.js';

const PORT = parseInt(process.env.RUNNER_PORT || '3002', 10);

// Shared job queue instance
const jobQueue = new JobQueue();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use(healthRouter);
app.use(createJobsRouter(jobQueue));

const server = app.listen(PORT, () => {
  console.log(`[tle-runner] listening on http://localhost:${PORT}`);
});

export { app, server, jobQueue };
