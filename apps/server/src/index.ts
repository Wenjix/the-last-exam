import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { healthRouter } from './routes/health.js';
import { matchesRouter } from './routes/matches.js';
import { setupWsHandlers } from './ws/index.js';
import { initDatabase } from './persistence/index.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use(healthRouter);
app.use(matchesRouter);

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
