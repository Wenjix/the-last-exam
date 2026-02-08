import type { WebSocket, WebSocketServer } from 'ws';

/** Track which match each WS client is watching */
const clientMatchMap = new Map<WebSocket, string>();
const matchClients = new Map<string, Set<WebSocket>>();

/**
 * Register a WS client to receive events for a match.
 */
export function joinMatch(ws: WebSocket, matchId: string): void {
  // Remove from previous match if any
  leaveMatch(ws);

  clientMatchMap.set(ws, matchId);
  if (!matchClients.has(matchId)) {
    matchClients.set(matchId, new Set());
  }
  matchClients.get(matchId)!.add(ws);
}

/**
 * Remove a WS client from match events.
 */
export function leaveMatch(ws: WebSocket): void {
  const matchId = clientMatchMap.get(ws);
  if (matchId) {
    const clients = matchClients.get(matchId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) matchClients.delete(matchId);
    }
    clientMatchMap.delete(ws);
  }
}

/**
 * Emit a game event to all clients watching a specific match.
 */
export function emitToMatch(matchId: string, event: Record<string, unknown>): void {
  const clients = matchClients.get(matchId);
  if (!clients) return;

  const payload = JSON.stringify(event);
  for (const ws of clients) {
    if (ws.readyState === 1) {
      // WebSocket.OPEN
      ws.send(payload);
    }
  }
}

/**
 * Emit a game event to all connected clients (broadcast).
 */
export function broadcast(wss: WebSocketServer, event: Record<string, unknown>): void {
  const payload = JSON.stringify(event);
  for (const ws of wss.clients) {
    if (ws.readyState === 1) {
      ws.send(payload);
    }
  }
}

/**
 * Set up WS connection handler with match room management.
 */
export function setupWsHandlers(wss: WebSocketServer): void {
  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
      }),
    );

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { type?: string; matchId?: string };
        if (msg.type === 'join_match' && msg.matchId) {
          joinMatch(ws, msg.matchId);
          ws.send(
            JSON.stringify({
              type: 'joined_match',
              matchId: msg.matchId,
              timestamp: new Date().toISOString(),
            }),
          );
        } else if (msg.type === 'leave_match') {
          leaveMatch(ws);
          ws.send(
            JSON.stringify({
              type: 'left_match',
              timestamp: new Date().toISOString(),
            }),
          );
        }
      } catch {
        // Invalid JSON — ignore
      }
    });

    ws.on('close', () => {
      leaveMatch(ws);
    });
  });
}
