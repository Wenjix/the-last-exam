import type { z } from 'zod';
import { ChallengeSchema, HazardSchema, ToolSchema, TraitSchema } from './schemas.js';
import type { Challenge, Hazard, Tool, Trait } from './schemas.js';

export class ContentValidationError extends Error {
  constructor(
    public readonly contentType: string,
    public readonly errors: z.ZodError,
  ) {
    super(`Invalid ${contentType} content: ${errors.message}`);
    this.name = 'ContentValidationError';
  }
}

/**
 * Parse and validate a single content item against its schema.
 */
function parseItem<T>(schema: z.ZodSchema<T>, data: unknown, contentType: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ContentValidationError(contentType, result.error);
  }
  return result.data;
}

/**
 * Parse and validate an array of content items.
 */
function parseArray<T>(schema: z.ZodSchema<T>, data: unknown[], contentType: string): T[] {
  return data.map((item, index) => {
    try {
      return parseItem(schema, item, contentType);
    } catch (err) {
      if (err instanceof ContentValidationError) {
        throw new ContentValidationError(`${contentType}[${index}]`, err.errors);
      }
      throw err;
    }
  });
}

// === Loaders ===

export function loadChallenges(data: unknown[]): Challenge[] {
  return parseArray(ChallengeSchema, data, 'challenge');
}

export function loadHazards(data: unknown[]): Hazard[] {
  return parseArray(HazardSchema, data, 'hazard');
}

export function loadTools(data: unknown[]): Tool[] {
  return parseArray(ToolSchema, data, 'tool');
}

export function loadTraits(data: unknown[]): Trait[] {
  return parseArray(TraitSchema, data, 'trait');
}

/**
 * Load all content from a data bundle object.
 * Expects { challenges: [...], hazards: [...], tools: [...], traits: [...] }
 */
export function loadAllContent(bundle: {
  challenges?: unknown[];
  hazards?: unknown[];
  tools?: unknown[];
  traits?: unknown[];
}): {
  challenges: Challenge[];
  hazards: Hazard[];
  tools: Tool[];
  traits: Trait[];
} {
  return {
    challenges: bundle.challenges ? loadChallenges(bundle.challenges) : [],
    hazards: bundle.hazards ? loadHazards(bundle.hazards) : [],
    tools: bundle.tools ? loadTools(bundle.tools) : [],
    traits: bundle.traits ? loadTraits(bundle.traits) : [],
  };
}
