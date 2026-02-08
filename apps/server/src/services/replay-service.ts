import type { ReplayResponse, ArtifactReference, StandingEntry } from '@tle/contracts';
import { getDatabase } from '../persistence/database.js';
import { getMatchEvents } from '../persistence/event-store.js';
import { getArtifacts } from '../persistence/artifact-store.js';
import type { StoredEvent } from '../persistence/event-store.js';
import type { StoredArtifact } from '../persistence/artifact-store.js';

export interface ReplayOptions {
  matchId: string;
  fromSequence?: number;
  toSequence?: number;
}

export interface ReplayResult {
  ok: true;
  data: ReplayResponse;
}

export interface ReplayError {
  ok: false;
  code: string;
  message: string;
}

/**
 * Reconstruct a full match timeline from persisted events and artifacts.
 *
 * This service is strictly read-only: it never invokes code generation,
 * LLM calls, or runner execution. All data comes from the event store
 * and artifact store.
 */
export function reconstructReplay(options: ReplayOptions): ReplayResult | ReplayError {
  const { matchId, fromSequence, toSequence } = options;

  // Look up match metadata from the database
  const db = getDatabase();
  const matchRow = db.prepare('SELECT id, seed, status FROM matches WHERE id = ?').get(matchId) as
    | { id: string; seed: string; status: string }
    | undefined;

  if (!matchRow) {
    return {
      ok: false,
      code: 'VALIDATION_MATCH_NOT_FOUND',
      message: 'Match not found',
    };
  }

  // Fetch events ordered by sequence_id (persistence layer handles ordering)
  const storedEvents: StoredEvent[] = getMatchEvents(matchId, fromSequence, toSequence);

  // Fetch all artifacts for this match (no filters — we want everything)
  const storedArtifacts: StoredArtifact[] = getArtifacts(matchId);

  // Map stored events to the replay contract shape
  const events = storedEvents.map((e) => ({
    sequenceId: e.sequenceId,
    event: {
      type: e.eventType,
      ...e.payload,
    } as ReplayResponse['events'][number]['event'],
  }));

  // Map stored artifacts to ArtifactReference (contract does not include content)
  const artifacts: ArtifactReference[] = storedArtifacts.map((a) => ({
    artifactId: a.id,
    type: a.artifactType as ArtifactReference['type'],
    agentId: a.agentId,
    round: a.round,
  }));

  // Extract final standings from the last final_standings event, if present
  const finalStandings = extractFinalStandings(storedEvents);

  // Count total events in the match (ignoring range filters) for pagination context
  const totalRow = db
    .prepare('SELECT COUNT(*) AS cnt FROM events WHERE match_id = ?')
    .get(matchId) as { cnt: number };

  const data: ReplayResponse = {
    matchId: matchRow.id,
    seed: matchRow.seed,
    events,
    artifacts,
    finalStandings,
    totalEvents: totalRow.cnt,
  };

  return { ok: true, data };
}

/**
 * Scan stored events (already in order) for the last `final_standings` event
 * and extract its standings array.
 */
function extractFinalStandings(events: StoredEvent[]): StandingEntry[] | null {
  // Walk backwards to find the most recent final_standings event
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.eventType === 'final_standings') {
      const standings = e.payload.standings;
      if (Array.isArray(standings)) {
        return standings as StandingEntry[];
      }
    }
  }
  return null;
}
