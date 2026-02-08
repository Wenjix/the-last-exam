import { Router } from 'express';
import { ReplayRequestSchema } from '@tle/contracts';
import { reconstructReplay } from '../services/replay-service.js';

export const replayRouter = Router();

/**
 * GET /matches/:id/replay
 *
 * Returns a self-contained replay payload for client replay viewer.
 * Read-only: no state mutations, no external calls.
 *
 * Query params (optional):
 *   fromSequence - start of event sequence range (inclusive)
 *   toSequence   - end of event sequence range (inclusive)
 */
replayRouter.get('/matches/:id/replay', (req, res) => {
  try {
    const matchId = req.params.id;

    // Parse optional sequence range from query params
    const fromSequence = parseOptionalInt(req.query.fromSequence);
    const toSequence = parseOptionalInt(req.query.toSequence);

    // Validate with the contract schema
    const parsed = ReplayRequestSchema.safeParse({
      matchId,
      fromSequence,
      toSequence,
    });

    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_SCHEMA',
          message: parsed.error.issues.map((i) => i.message).join('; '),
        },
      });
      return;
    }

    const result = reconstructReplay({
      matchId: parsed.data.matchId,
      fromSequence: parsed.data.fromSequence,
      toSequence: parsed.data.toSequence,
    });

    if (!result.ok) {
      const status = result.code === 'VALIDATION_MATCH_NOT_FOUND' ? 404 : 500;
      res.status(status).json({
        error: { code: result.code, message: result.message },
      });
      return;
    }

    res.json(result.data);
  } catch {
    res.status(500).json({
      error: { code: 'INTERNAL_UNEXPECTED', message: 'Failed to fetch replay' },
    });
  }
});

/**
 * Parse a query parameter as an optional integer.
 */
function parseOptionalInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  if (Number.isNaN(num)) return undefined;
  return num;
}
