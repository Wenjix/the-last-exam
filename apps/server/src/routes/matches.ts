import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

// In-memory match store (will be replaced by SQLite later)
const matches = new Map<string, MatchRecord>();

interface MatchRecord {
  id: string;
  seed: string;
  status: 'pending' | 'active' | 'completed';
  currentRound: number;
  currentPhase: string;
  managers: Array<{ id: string; name: string; role: 'human' | 'bot' }>;
  scores: Record<string, number>;
  phaseDeadline: string | null;
  createdAt: string;
}

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

    const match: MatchRecord = {
      id: uuidv4(),
      seed: seed || uuidv4(),
      status: 'active',
      currentRound: 1,
      currentPhase: 'briefing',
      managers: managers.map((m: { id?: string; name: string; role: string }) => ({
        id: m.id || uuidv4(),
        name: m.name,
        role: m.role as 'human' | 'bot',
      })),
      scores: {},
      phaseDeadline: null,
      createdAt: new Date().toISOString(),
    };

    // Initialize scores
    for (const m of match.managers) {
      match.scores[m.id] = 0;
    }

    matches.set(match.id, match);
    res.status(201).json(match);
  } catch {
    res.status(500).json({
      error: { code: 'INTERNAL_UNEXPECTED', message: 'Failed to create match' },
    });
  }
});

// GET /matches/:id - Get match state
matchesRouter.get('/matches/:id', (req, res) => {
  const match = matches.get(req.params.id);
  if (!match) {
    res.status(404).json({
      error: { code: 'VALIDATION_MATCH_NOT_FOUND', message: 'Match not found' },
    });
    return;
  }
  res.json(match);
});

// POST /matches/:id/bids - Submit a bid
matchesRouter.post('/matches/:id/bids', (req, res) => {
  const match = matches.get(req.params.id);
  if (!match) {
    res.status(404).json({
      error: { code: 'VALIDATION_MATCH_NOT_FOUND', message: 'Match not found' },
    });
    return;
  }

  if (match.currentPhase !== 'hidden_bid') {
    res.status(400).json({
      error: {
        code: 'VALIDATION_BID_PHASE_CLOSED',
        message: 'Bids only accepted during hidden_bid phase',
      },
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

  res.json({ success: true, message: 'Bid accepted', idempotencyKey });
});

// POST /matches/:id/equips - Submit equip selections
matchesRouter.post('/matches/:id/equips', (req, res) => {
  const match = matches.get(req.params.id);
  if (!match) {
    res.status(404).json({
      error: { code: 'VALIDATION_MATCH_NOT_FOUND', message: 'Match not found' },
    });
    return;
  }

  if (match.currentPhase !== 'equip') {
    res.status(400).json({
      error: {
        code: 'VALIDATION_EQUIP_PHASE_CLOSED',
        message: 'Equip only accepted during equip phase',
      },
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

  res.json({
    success: true,
    equippedTools: toolSelections || [],
    appliedHazards: hazardAssignments || [],
    idempotencyKey,
  });
});

// Export the store for other modules
export { matches };
