import { z } from 'zod';
import { GameEventSchema } from '../match/schemas.js';

// === Replay Event (with sequence ID) ===

export const ReplayEventSchema = z.object({
  sequenceId: z.number().int().min(0),
  event: GameEventSchema,
});
export type ReplayEvent = z.infer<typeof ReplayEventSchema>;

// === Replay Request ===

export const ReplayRequestSchema = z.object({
  matchId: z.string().uuid(),
  fromSequence: z.number().int().min(0).optional(),
  toSequence: z.number().int().min(0).optional(),
});
export type ReplayRequest = z.infer<typeof ReplayRequestSchema>;

// === Artifact Reference ===

export const ArtifactReferenceSchema = z.object({
  artifactId: z.string().uuid(),
  type: z.enum(['submitted_code', 'harness_output', 'execution_log', 'score_breakdown']),
  agentId: z.string().uuid(),
  round: z.number().int().min(1).max(5),
});
export type ArtifactReference = z.infer<typeof ArtifactReferenceSchema>;

// === Standing Entry ===

export const StandingEntrySchema = z.object({
  managerId: z.string().uuid(),
  managerName: z.string(),
  totalScore: z.number(),
  rank: z.number().int().min(1),
  roundScores: z.array(z.number()),
});
export type StandingEntry = z.infer<typeof StandingEntrySchema>;

// === Replay Response ===

export const ReplayResponseSchema = z.object({
  matchId: z.string().uuid(),
  seed: z.string(),
  events: z.array(ReplayEventSchema),
  artifacts: z.array(ArtifactReferenceSchema),
  finalStandings: z.array(StandingEntrySchema).nullable(),
  totalEvents: z.number().int().min(0),
});
export type ReplayResponse = z.infer<typeof ReplayResponseSchema>;
