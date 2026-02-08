import { z } from 'zod';

// === Bid Submission ===

export const BidSubmissionSchema = z.object({
  managerId: z.string().uuid(),
  round: z.number().int().min(1).max(5),
  amount: z.number().int().min(0),
  idempotencyKey: z.string().uuid(),
});
export type BidSubmission = z.infer<typeof BidSubmissionSchema>;

export const BidResultSchema = z.object({
  managerId: z.string().uuid(),
  round: z.number().int().min(1).max(5),
  amount: z.number().int().min(0),
  rank: z.number().int().min(1),
  accepted: z.boolean(),
});
export type BidResult = z.infer<typeof BidResultSchema>;

export const BidResponseSchema = z.object({
  success: z.boolean(),
  bidResult: BidResultSchema.optional(),
  message: z.string().optional(),
});
export type BidResponse = z.infer<typeof BidResponseSchema>;

// === Equip Submission ===

export const EquipSubmissionSchema = z.object({
  managerId: z.string().uuid(),
  round: z.number().int().min(1).max(5),
  toolSelections: z.array(z.string()),
  hazardAssignments: z.array(z.string()),
  idempotencyKey: z.string().uuid(),
});
export type EquipSubmission = z.infer<typeof EquipSubmissionSchema>;

export const EquipResponseSchema = z.object({
  success: z.boolean(),
  equippedTools: z.array(z.string()).optional(),
  appliedHazards: z.array(z.string()).optional(),
  message: z.string().optional(),
});
export type EquipResponse = z.infer<typeof EquipResponseSchema>;

// === Validation Error ===

export const ValidationErrorSchema = z.object({
  code: z.string(),
  field: z.string().optional(),
  message: z.string(),
  constraint: z.string().optional(),
});
export type ValidationError = z.infer<typeof ValidationErrorSchema>;

export const SubmissionErrorResponseSchema = z.object({
  success: z.literal(false),
  errors: z.array(ValidationErrorSchema),
});
export type SubmissionErrorResponse = z.infer<typeof SubmissionErrorResponseSchema>;
