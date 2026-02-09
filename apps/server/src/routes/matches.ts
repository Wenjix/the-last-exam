import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createMatch,
  getActiveMatch,
  getMatchState,
  submitBid,
  submitStrategy,
} from '../orchestrator/index.js';

export const matchesRouter = Router();

// POST /matches - Create a new match
matchesRouter.post('/matches', (req, res) => {
  try {
    const { seed, managers } = req.body;

    if (!managers || !Array.isArray(managers) || managers.length !== 4) {
      res.status(400).json({
        error: { code: 'VALIDATION_SCHEMA', message: 'Exactly 4 managers required' },
      });
      return;
    }

    const humanCount = managers.filter((m: { role: string }) => m.role === 'human').length;
    if (humanCount !== 1) {
      res.status(400).json({
        error: { code: 'VALIDATION_SCHEMA', message: 'Exactly 1 human manager required' },
      });
      return;
    }

    const managerStates = managers.map((m: { id?: string; name: string; role: string }) => ({
      id: m.id || uuidv4(),
      name: m.name,
      role: m.role as 'human' | 'bot',
    }));

    const match = createMatch(managerStates, seed);
    res.status(201).json(getMatchState(match.id));
  } catch {
    res.status(500).json({
      error: { code: 'INTERNAL_UNEXPECTED', message: 'Failed to create match' },
    });
  }
});

// GET /matches/:id - Get match state
matchesRouter.get('/matches/:id', (req, res) => {
  const state = getMatchState(req.params.id);
  if (!state) {
    res.status(404).json({
      error: { code: 'VALIDATION_MATCH_NOT_FOUND', message: 'Match not found' },
    });
    return;
  }
  res.json(state);
});

// POST /matches/:id/bids - Submit a bid
matchesRouter.post('/matches/:id/bids', (req, res) => {
  const match = getActiveMatch(req.params.id);
  if (!match) {
    res.status(404).json({
      error: { code: 'VALIDATION_MATCH_NOT_FOUND', message: 'Match not found' },
    });
    return;
  }

  const { managerId, round, amount, idempotencyKey } = req.body;

  if (!managerId || round === undefined || amount === undefined) {
    res.status(400).json({
      error: { code: 'VALIDATION_SCHEMA', message: 'managerId, round, and amount required' },
    });
    return;
  }

  if (!Number.isInteger(amount) || amount < 0) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_BID_OUT_OF_RANGE',
        message: 'Bid must be a non-negative integer',
      },
    });
    return;
  }

  if (round !== match.round) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ROUND_MISMATCH',
        message: `Round mismatch: match is on round ${match.round}`,
      },
    });
    return;
  }

  const success = submitBid(req.params.id, managerId, amount);
  if (!success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_BID_PHASE_CLOSED',
        message: 'Bids only accepted during bidding phase or bid exceeds budget',
      },
    });
    return;
  }

  res.json({ success: true, message: 'Bid accepted', idempotencyKey });
});

// POST /matches/:id/strategy - Submit a strategy prompt
matchesRouter.post('/matches/:id/strategy', (req, res) => {
  const match = getActiveMatch(req.params.id);
  if (!match) {
    res.status(404).json({
      error: { code: 'VALIDATION_MATCH_NOT_FOUND', message: 'Match not found' },
    });
    return;
  }

  const { managerId, round, prompt, idempotencyKey } = req.body;

  if (!managerId || round === undefined || !prompt) {
    res.status(400).json({
      error: { code: 'VALIDATION_SCHEMA', message: 'managerId, round, and prompt required' },
    });
    return;
  }

  if (round !== match.round) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ROUND_MISMATCH',
        message: `Round mismatch: match is on round ${match.round}`,
      },
    });
    return;
  }

  const success = submitStrategy(req.params.id, managerId, prompt);
  if (!success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_STRATEGY_PHASE_CLOSED',
        message: 'Strategy only accepted during strategy phase',
      },
    });
    return;
  }

  res.json({ success: true, message: 'Strategy accepted', idempotencyKey });
});
