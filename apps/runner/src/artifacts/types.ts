import type { ScoreBreakdown } from '@tle/contracts';
import type { HarnessResult } from '../harness/harness-types.js';

// === Run Artifact ===

/**
 * A persistent record of a single code-execution run.
 *
 * Stored per match/round/agent combination so that every submission and its
 * evaluation results can be reviewed after the fact (demo, replay, debugging).
 */
export interface RunArtifact {
  /** Match this run belongs to. */
  matchId: string;
  /** 1-based round number within the match. */
  round: number;
  /** Agent that submitted the code. */
  agentId: string;
  /** The source code that was submitted for execution. */
  submittedCode: string;
  /** Full harness evaluation output, if a harness was run. */
  harnessOutput: HarnessResult | null;
  /** Raw execution logs (stdout + stderr combined). */
  executionLogs: string;
  /** Detailed score breakdown produced by the scoring pipeline. */
  scoreBreakdown: ScoreBreakdown | null;
  /** ISO-8601 timestamp of when the artifact was recorded. */
  timestamp: string;
}

/** Composite key used to look up a specific run artifact. */
export interface ArtifactKey {
  matchId: string;
  round: number;
  agentId: string;
}
