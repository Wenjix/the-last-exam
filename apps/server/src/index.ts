import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { healthRouter } from './routes/health.js';
import { matchesRouter } from './routes/matches.js';
import { replayRouter } from './routes/replay.js';
import { setupWsHandlers } from './ws/index.js';
import { initDatabase } from './persistence/index.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

// Parse allowed origins from environment, default to localhost dev servers
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:5173'
).split(',').map((o) => o.trim()).filter(Boolean);

const app = express();
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
  }),
);
app.use(express.json());

// Routes
app.use(healthRouter);
app.use(matchesRouter);
app.use(replayRouter);

// Create HTTP server for both REST and WS
const server = createServer(app);

// WebSocket server on same HTTP server
const wss = new WebSocketServer({ server, path: '/ws' });
setupWsHandlers(wss);

// Initialize persistence
try {
  initDatabase();
  console.log('[tle-server] Database initialized');
} catch (err) {
  console.warn('[tle-server] Database init skipped:', err instanceof Error ? err.message : err);
}

server.listen(PORT, () => {
  console.log(`[tle-server] listening on http://localhost:${PORT}`);
  console.log(`[tle-server] WebSocket on ws://localhost:${PORT}/ws`);
});

export { app, server, wss };
