import { z } from 'zod';

// === Runner Job Intake ===

export const RunnerJobSchema = z.object({
  jobId: z.string().uuid(),
  matchId: z.string().uuid(),
  challengeId: z.string(),
  agentId: z.string().uuid(),
  round: z.number().int().min(1).max(5),
  tools: z.array(z.string()),
  hazards: z.array(z.string()),
  contextSnapshot: z.record(z.string(), z.unknown()),
});
export type RunnerJob = z.infer<typeof RunnerJobSchema>;

// === Harness Test Result ===

export const TestCaseResultSchema = z.object({
  testId: z.string(),
  passed: z.boolean(),
  input: z.string().optional(),
  expectedOutput: z.string().optional(),
  actualOutput: z.string().optional(),
  errorMessage: z.string().optional(),
});
export type TestCaseResult = z.infer<typeof TestCaseResultSchema>;

// === Execution Metadata ===

export const ExecutionMetadataSchema = z.object({
  durationMs: z.number().int().min(0),
  memoryUsedBytes: z.number().int().min(0).optional(),
  cpuTimeMs: z.number().int().min(0).optional(),
  exitCode: z.number().int(),
  timedOut: z.boolean(),
  sandboxId: z.string().optional(),
});
export type ExecutionMetadata = z.infer<typeof ExecutionMetadataSchema>;

// === Score Breakdown ===

export const ScoreBreakdownSchema = z.object({
  correctness: z.number().min(0).max(1),
  latencyFactor: z.number().min(0).max(1).optional(),
  resourceFactor: z.number().min(0).max(1).optional(),
  baseScore: z.number().min(0),
  llmBonus: z.number().min(0).optional(),
  totalScore: z.number().min(0),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

// === Runner Result ===

export const RunnerFailureReason = z.enum([
  'compilation_error',
  'runtime_error',
  'timeout',
  'memory_limit',
  'sandbox_error',
  'generation_error',
  'unknown',
]);
export type RunnerFailureReason = z.infer<typeof RunnerFailureReason>;

export const RunnerResultSchema = z.object({
  jobId: z.string().uuid(),
  matchId: z.string().uuid(),
  agentId: z.string().uuid(),
  round: z.number().int().min(1).max(5),
  success: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  submittedCode: z.string(),
  harnessResults: z.array(TestCaseResultSchema),
  executionMetadata: ExecutionMetadataSchema,
  scoreBreakdown: ScoreBreakdownSchema.optional(),
  failureReason: RunnerFailureReason.optional(),
});
export type RunnerResult = z.infer<typeof RunnerResultSchema>;

// === Runner Callback ===

export const RunnerCallbackSchema = z.object({
  result: RunnerResultSchema,
  idempotencyKey: z.string().uuid(),
  timestamp: z.string().datetime(),
});
export type RunnerCallback = z.infer<typeof RunnerCallbackSchema>;
