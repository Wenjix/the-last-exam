import { z } from 'zod';

// === Challenge Schema ===

export const TestCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  isHidden: z.boolean().default(false),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

export const ChallengeSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  inputSpec: z.string(),
  outputSpec: z.string(),
  testCases: z.array(TestCaseSchema).min(1),
  timeoutMs: z.number().int().min(1000).default(60000),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

// === Hazard Schema ===

export const ModifierEffectSchema = z.object({
  target: z.enum(['time', 'memory', 'visibility', 'input', 'stdlib']),
  operation: z.enum(['multiply', 'add', 'set', 'restrict']),
  value: z.union([z.number(), z.string(), z.boolean()]),
});
export type ModifierEffect = z.infer<typeof ModifierEffectSchema>;

export const HazardSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().min(1),
  modifierEffects: z.array(ModifierEffectSchema).min(1),
});
export type Hazard = z.infer<typeof HazardSchema>;

// === Tool Schema ===

export const ToolEffectSchema = z.object({
  target: z.enum(['time', 'memory', 'hints', 'debug', 'tests', 'retries', 'template']),
  operation: z.enum(['multiply', 'add', 'set', 'grant']),
  value: z.union([z.number(), z.string(), z.boolean()]),
});
export type ToolEffect = z.infer<typeof ToolEffectSchema>;

export const ToolSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().min(1),
  effects: z.array(ToolEffectSchema).min(1),
});
export type Tool = z.infer<typeof ToolSchema>;

// === Trait Schema (flavor-only in MVP) ===

export const TraitSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  flavorText: z.string().min(1),
  visualTag: z.string().min(1),
});
export type Trait = z.infer<typeof TraitSchema>;
