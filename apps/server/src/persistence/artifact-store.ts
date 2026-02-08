import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database.js';

export interface StoredArtifact {
  id: string;
  matchId: string;
  round: number;
  agentId: string;
  artifactType: string;
  content: string;
  createdAt: string;
}

/**
 * Store a run artifact (code, output, logs, scores).
 */
export function storeArtifact(
  matchId: string,
  round: number,
  agentId: string,
  artifactType: string,
  content: string,
): StoredArtifact {
  const db = getDatabase();
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  db.prepare(
    'INSERT INTO artifacts (id, match_id, round, agent_id, artifact_type, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, matchId, round, agentId, artifactType, content, createdAt);

  return { id, matchId, round, agentId, artifactType, content, createdAt };
}

/**
 * Get artifacts for a specific match+round+agent.
 */
export function getArtifacts(matchId: string, round?: number, agentId?: string): StoredArtifact[] {
  const db = getDatabase();

  let sql = 'SELECT * FROM artifacts WHERE match_id = ?';
  const params: (string | number)[] = [matchId];

  if (round !== undefined) {
    sql += ' AND round = ?';
    params.push(round);
  }
  if (agentId) {
    sql += ' AND agent_id = ?';
    params.push(agentId);
  }

  sql += ' ORDER BY round, created_at';

  const rows = db.prepare(sql).all(...params) as Array<{
    id: string;
    match_id: string;
    round: number;
    agent_id: string;
    artifact_type: string;
    content: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    matchId: row.match_id,
    round: row.round,
    agentId: row.agent_id,
    artifactType: row.artifact_type,
    content: row.content,
    createdAt: row.created_at,
  }));
}
