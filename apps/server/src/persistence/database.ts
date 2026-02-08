import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';

let db: Database.Database | null = null;

/**
 * Initialize SQLite database with schema.
 * Creates the DB file and parent directory if they don't exist.
 */
export function initDatabase(dbPath?: string): Database.Database {
  const path = dbPath || join(process.cwd(), 'data', 'tle.db');
  mkdirSync(dirname(path), { recursive: true });

  db = new Database(path);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  // Run migrations
  runMigrations(db);

  return db;
}

/**
 * Get the active database instance.
 */
export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

/**
 * Close the database connection.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Run database schema migrations.
 */
function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      seed TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT NOT NULL,
      sequence_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (match_id) REFERENCES matches(id),
      UNIQUE(match_id, sequence_id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_match_seq
      ON events(match_id, sequence_id);

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      round INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      content TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (match_id) REFERENCES matches(id)
    );

    CREATE INDEX IF NOT EXISTS idx_artifacts_match_round
      ON artifacts(match_id, round);
  `);
}
