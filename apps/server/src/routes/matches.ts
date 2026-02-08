import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createMatch,
  getActiveMatch,
  getMatchState,
  submitBid,
  submitEquip,
} from '../orchestrator/index.js';

export const matchesRouter = Router();

// POST /matches - Create a new match
matchesRouter.post('/matches', (req, res) => {
  try {
    const { seed, managers } = req.body;

    // Basic validation
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

    // Create match via orchestrator (starts game loop + WS events)
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

  const success = submitBid(req.params.id, managerId, amount);
  if (!success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_BID_PHASE_CLOSED',
        message: 'Bids only accepted during hidden_bid phase',
      },
    });
    return;
  }

  res.json({ success: true, message: 'Bid accepted', idempotencyKey });
});

// POST /matches/:id/equips - Submit equip selections
matchesRouter.post('/matches/:id/equips', (req, res) => {
  const match = getActiveMatch(req.params.id);
  if (!match) {
    res.status(404).json({
      error: { code: 'VALIDATION_MATCH_NOT_FOUND', message: 'Match not found' },
    });
    return;
  }

  const { managerId, round, toolSelections, hazardAssignments, idempotencyKey } = req.body;

  if (!managerId || round === undefined) {
    res.status(400).json({
      error: { code: 'VALIDATION_SCHEMA', message: 'managerId and round required' },
    });
    return;
  }

  const success = submitEquip(
    req.params.id,
    managerId,
    toolSelections || [],
    hazardAssignments || [],
  );
  if (!success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_EQUIP_PHASE_CLOSED',
        message: 'Equip only accepted during equip phase',
      },
    });
    return;
  }

  res.json({
    success: true,
    equippedTools: toolSelections || [],
    appliedHazards: hazardAssignments || [],
    idempotencyKey,
  });
});
