/**
 * Returns the base URL for REST API calls.
 * In development (no VITE_API_URL set), returns '' so fetch uses relative URLs
 * handled by the Vite dev proxy.
 * In production, returns the full URL (e.g. "https://tle-server.up.railway.app").
 */
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? '';
}

/**
 * Returns the WebSocket URL for the match event stream.
 * Converts VITE_API_URL from https:// to wss:// (or http:// to ws://).
 * Falls back to ws://localhost:3001/ws for local dev.
 */
export function getWsUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    return `ws://${window.location.hostname}:3001/ws`;
  }
  return apiUrl.replace(/^http/, 'ws') + '/ws';
}
