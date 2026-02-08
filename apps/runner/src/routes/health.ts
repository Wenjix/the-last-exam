import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'tle-runner',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
