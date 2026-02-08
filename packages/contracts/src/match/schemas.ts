import { z } from 'zod';

// === Phase and Match Enums ===

export const MatchPhase = z.enum([
  'briefing',
  'bidding',
  'strategy',
  'execution',
  'scoring',
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
  budgets: z.record(z.string().uuid(), z.number()).optional(),
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

// === Agent Stream Events (Execution Phase) ===

export const AgentStreamLanguage = z.enum(['python', 'typescript', 'javascript']);
export type AgentStreamLanguage = z.infer<typeof AgentStreamLanguage>;

export const AgentStreamChunkType = z.enum(['code', 'thinking', 'stdout', 'stderr']);
export type AgentStreamChunkType = z.infer<typeof AgentStreamChunkType>;

export const AgentStreamStartEventSchema = z.object({
  type: z.literal('agent_stream_start'),
  matchId: z.string().uuid(),
  managerId: z.string().uuid(),
  round: z.number().int().min(1).max(5),
  language: AgentStreamLanguage,
  timestamp: z.string().datetime(),
});
export type AgentStreamStartEvent = z.infer<typeof AgentStreamStartEventSchema>;

export const AgentStreamChunkEventSchema = z.object({
  type: z.literal('agent_stream_chunk'),
  matchId: z.string().uuid(),
  managerId: z.string().uuid(),
  round: z.number().int().min(1).max(5),
  chunkType: AgentStreamChunkType,
  content: z.string(),
  lineNumber: z.number().int().min(0),
  timestamp: z.string().datetime(),
});
export type AgentStreamChunkEvent = z.infer<typeof AgentStreamChunkEventSchema>;

export const AgentStreamTestResultEventSchema = z.object({
  type: z.literal('agent_stream_test_result'),
  matchId: z.string().uuid(),
  managerId: z.string().uuid(),
  round: z.number().int().min(1).max(5),
  testIndex: z.number().int().min(0),
  totalTests: z.number().int().min(1),
  passed: z.boolean(),
  errorMessage: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type AgentStreamTestResultEvent = z.infer<typeof AgentStreamTestResultEventSchema>;

export const AgentStreamCompleteEventSchema = z.object({
  type: z.literal('agent_stream_complete'),
  matchId: z.string().uuid(),
  managerId: z.string().uuid(),
  round: z.number().int().min(1).max(5),
  success: z.boolean(),
  totalLines: z.number().int().min(0),
  testsPassed: z.number().int().min(0),
  testsTotal: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  timestamp: z.string().datetime(),
});
export type AgentStreamCompleteEvent = z.infer<typeof AgentStreamCompleteEventSchema>;

// === Game Event Union ===

export const GameEventSchema = z.discriminatedUnion('type', [
  PhaseTransitionEventSchema,
  RoundResultEventSchema,
  CommentaryUpdateEventSchema,
  MatchCompleteEventSchema,
  FinalStandingsEventSchema,
  AgentStreamStartEventSchema,
  AgentStreamChunkEventSchema,
  AgentStreamTestResultEventSchema,
  AgentStreamCompleteEventSchema,
]);
export type GameEvent = z.infer<typeof GameEventSchema>;
