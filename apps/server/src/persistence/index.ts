export { initDatabase, getDatabase, closeDatabase } from './database.js';
export { appendEvent, getMatchEvents } from './event-store.js';
export type { StoredEvent } from './event-store.js';
export { storeArtifact, getArtifacts } from './artifact-store.js';
export type { StoredArtifact } from './artifact-store.js';
