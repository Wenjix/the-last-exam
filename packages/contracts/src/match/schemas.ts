import { z } from 'zod';

// === Phase and Match Enums ===

export const MatchPhase = z.enum([
  'briefing',
  'hidden_bid',
  'bid_resolve',
  'equip',
  'run',
  'resolve',
  'final_standings',
]);
export type MatchPhase = z.infer<typeof MatchPhase>;

export const MatchStatus = z.enum(['pending', 'active', 'completed']);
export type MatchStatus = z.infer<typeof MatchStatus>;

export const ManagerRole = z.enum(['human', 'bot']);
export type ManagerRole = z.infer<typeof ManagerRole>;

// === Manager Schema ===

export const ManagerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  role: ManagerRole,
});
export type Manager = z.infer<typeof ManagerSchema>;

// === REST: Create Match ===

export const CreateMatchRequestSchema = z.object({
  seed: z.string().optional(),
  managers: z
    .array(ManagerSchema)
    .length(4)
    .refine((managers) => managers.filter((m) => m.role === 'human').length === 1, {
      message: 'Exactly 1 human manager required',
    }),
});
export type CreateMatchRequest = z.infer<typeof CreateMatchRequestSchema>;

export const MatchStateSchema = z.object({
  id: z.string().uuid(),
  seed: z.string(),
  status: MatchStatus,
  currentRound: z.number().int().min(1).max(5),
  currentPhase: MatchPhase,
  managers: z.array(ManagerSchema),
  phaseDeadline: z.string().datetime().nullable(),
  scores: z.record(z.string().uuid(), z.number()),
  createdAt: z.string().datetime(),
});
export type MatchState = z.infer<typeof MatchStateSchema>;

export const CreateMatchResponseSchema = MatchStateSchema;
export type CreateMatchResponse = MatchState;

export const GetMatchResponseSchema = MatchStateSchema;
export type GetMatchResponse = MatchState;

// === WS Event Types ===

export const PhaseTransitionEventSchema = z.object({
  type: z.literal('phase_transition'),
  matchId: z.string().uuid(),
  round: z.number().int().min(1).max(5),
  fromPhase: MatchPhase,
  toPhase: MatchPhase,
  deadline: z.string().datetime().nullable(),
  timestamp: z.string().datetime(),
});
export type PhaseTransitionEvent = z.infer<typeof PhaseTransitionEventSchema>;

export const RoundResultEventSchema = z.object({
  type: z.literal('round_result'),
  matchId: z.string().uuid(),
  round: z.number().int().min(1).max(5),
  results: z.array(
    z.object({
      managerId: z.string().uuid(),
      score: z.number(),
      correctness: z.number().min(0).max(1),
      latencyMs: z.number().int().min(0).optional(),
    }),
  ),
  standings: z.record(z.string().uuid(), z.number()),
  timestamp: z.string().datetime(),
});
export type RoundResultEvent = z.infer<typeof RoundResultEventSchema>;

export const CommentaryUpdateEventSchema = z.object({
  type: z.literal('commentary_update'),
  matchId: z.string().uuid(),
  round: z.number().int().min(1).max(5),
  text: z.string(),
  audioUrl: z.string().url().nullable(),
  language: z.string().default('en'),
  timestamp: z.string().datetime(),
});
export type CommentaryUpdateEvent = z.infer<typeof CommentaryUpdateEventSchema>;

export const MatchCompleteEventSchema = z.object({
  type: z.literal('match_complete'),
  matchId: z.string().uuid(),
  timestamp: z.string().datetime(),
});
export type MatchCompleteEvent = z.infer<typeof MatchCompleteEventSchema>;

export const FinalStandingsEventSchema = z.object({
  type: z.literal('final_standings'),
  matchId: z.string().uuid(),
  standings: z.array(
    z.object({
      managerId: z.string().uuid(),
      managerName: z.string(),
      totalScore: z.number(),
      rank: z.number().int().min(1),
      roundScores: z.array(z.number()),
    }),
  ),
  timestamp: z.string().datetime(),
});
export type FinalStandingsEvent = z.infer<typeof FinalStandingsEventSchema>;

export const GameEventSchema = z.discriminatedUnion('type', [
  PhaseTransitionEventSchema,
  RoundResultEventSchema,
  CommentaryUpdateEventSchema,
  MatchCompleteEventSchema,
  FinalStandingsEventSchema,
]);
export type GameEvent = z.infer<typeof GameEventSchema>;
