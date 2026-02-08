import { getDatabase } from './database.js';

export interface StoredEvent {
  id: number;
  matchId: string;
  sequenceId: number;
  eventType: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

/**
 * Append an event to the event log.
 * Sequence IDs are monotonically increasing per match.
 */
export function appendEvent(
  matchId: string,
  eventType: string,
  payload: Record<string, unknown>,
): StoredEvent {
  const db = getDatabase();

  // Get next sequence ID for this match
  const row = db
    .prepare('SELECT COALESCE(MAX(sequence_id), -1) + 1 AS next_seq FROM events WHERE match_id = ?')
    .get(matchId) as { next_seq: number };

  const sequenceId = row.next_seq;
  const timestamp = new Date().toISOString();
  const payloadJson = JSON.stringify(payload);

  const result = db
    .prepare(
      'INSERT INTO events (match_id, sequence_id, event_type, payload, timestamp) VALUES (?, ?, ?, ?, ?)',
    )
    .run(matchId, sequenceId, eventType, payloadJson, timestamp);

  return {
    id: Number(result.lastInsertRowid),
    matchId,
    sequenceId,
    eventType,
    payload,
    timestamp,
  };
}

/**
 * Get all events for a match, ordered by sequence ID.
 */
export function getMatchEvents(matchId: string, fromSeq?: number, toSeq?: number): StoredEvent[] {
  const db = getDatabase();

  let sql = 'SELECT * FROM events WHERE match_id = ?';
  const params: (string | number)[] = [matchId];

  if (fromSeq !== undefined) {
    sql += ' AND sequence_id >= ?';
    params.push(fromSeq);
  }
  if (toSeq !== undefined) {
    sql += ' AND sequence_id <= ?';
    params.push(toSeq);
  }

  sql += ' ORDER BY sequence_id ASC';

  const rows = db.prepare(sql).all(...params) as Array<{
    id: number;
    match_id: string;
    sequence_id: number;
    event_type: string;
    payload: string;
    timestamp: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    matchId: row.match_id,
    sequenceId: row.sequence_id,
    eventType: row.event_type,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    timestamp: row.timestamp,
  }));
}
