import type { RunArtifact, ArtifactKey } from './types.js';

// === Artifact Store ===

/**
 * In-memory store for per-run artifacts.
 *
 * Keyed by a composite `matchId:round:agentId` string so that each
 * submission is uniquely addressable.  All artifacts are kept for the
 * lifetime of the process (hackathon demo -- no cleanup needed).
 *
 * Thread-safety: Node.js is single-threaded so concurrent access
 * is not a concern.  If we ever move to a persistent backend the
 * interface stays the same.
 */
export class ArtifactStore {
  private readonly artifacts = new Map<string, RunArtifact>();

  // --- Key helpers ---

  private static toKey(key: ArtifactKey): string {
    return `${key.matchId}:${key.round}:${key.agentId}`;
  }

  // --- Public API ---

  /** Store (or overwrite) an artifact for the given match/round/agent. */
  store(artifact: RunArtifact): void {
    const key = ArtifactStore.toKey({
      matchId: artifact.matchId,
      round: artifact.round,
      agentId: artifact.agentId,
    });
    this.artifacts.set(key, artifact);
  }

  /** Retrieve a single artifact by its composite key. Returns undefined if not found. */
  get(key: ArtifactKey): RunArtifact | undefined {
    return this.artifacts.get(ArtifactStore.toKey(key));
  }

  /** Retrieve all artifacts for a given match, ordered by round then agentId. */
  getByMatch(matchId: string): RunArtifact[] {
    const results: RunArtifact[] = [];
    for (const artifact of this.artifacts.values()) {
      if (artifact.matchId === matchId) {
        results.push(artifact);
      }
    }
    return results.sort((a, b) => a.round - b.round || a.agentId.localeCompare(b.agentId));
  }

  /** Retrieve all artifacts for a specific agent within a match. */
  getByAgent(matchId: string, agentId: string): RunArtifact[] {
    const results: RunArtifact[] = [];
    for (const artifact of this.artifacts.values()) {
      if (artifact.matchId === matchId && artifact.agentId === agentId) {
        results.push(artifact);
      }
    }
    return results.sort((a, b) => a.round - b.round);
  }

  /** Total number of stored artifacts. */
  get size(): number {
    return this.artifacts.size;
  }

  /** Remove all stored artifacts (useful for tests). */
  clear(): void {
    this.artifacts.clear();
  }
}
