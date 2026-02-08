import { v4 as uuidv4 } from 'uuid';
import type { RunnerResult } from '@tle/contracts';
import { scoreRunnerResult } from '@tle/game-core';
import type { ScoreResult } from '@tle/game-core';
import { emitToMatch } from '../ws/event-stream.js';
import { appendEvent } from '../persistence/event-store.js';
import { clearRoundCache } from '../middleware/idempotency.js';

// === Types (inline to avoid cross-package build issues) ===

const PHASES = ['briefing', 'hidden_bid', 'bid_resolve', 'equip', 'run', 'resolve'] as const;
type RoundPhase = (typeof PHASES)[number];
type TerminalPhase = 'final_standings';
type MatchPhase = RoundPhase | TerminalPhase;

const TOTAL_ROUNDS = 5;

const PHASE_DURATIONS_MS: Record<string, number> = {
  briefing: 10_000,
  hidden_bid: 30_000,
  bid_resolve: 5_000,
  equip: 30_000,
  run: 60_000,
  resolve: 15_000,
  final_standings: 0,
};

// === Match State ===

interface ManagerState {
  id: string;
  name: string;
  role: 'human' | 'bot';
}

interface ActiveMatch {
  id: string;
  seed: string;
  status: 'active' | 'completed';
  round: number;
  phase: MatchPhase;
  managers: ManagerState[];
  scores: Record<string, number>;
  roundScores: Record<string, number[]>;
  phaseDeadline: Date | null;
  phaseTimer: ReturnType<typeof setTimeout> | null;
  bids: Map<string, number>;
  equips: Map<string, { tools: string[]; hazards: string[] }>;
}

const activeMatches = new Map<string, ActiveMatch>();

// === Orchestrator ===

/**
 * Create and start a new match.
 */
export function createMatch(managers: ManagerState[], seed?: string): ActiveMatch {
  const matchId = uuidv4();
  const matchSeed = seed || uuidv4();

  const match: ActiveMatch = {
    id: matchId,
    seed: matchSeed,
    status: 'active',
    round: 1,
    phase: 'briefing',
    managers,
    scores: {},
    roundScores: {},
    phaseDeadline: null,
    phaseTimer: null,
    bids: new Map(),
    equips: new Map(),
  };

  // Initialize scores
  for (const m of managers) {
    match.scores[m.id] = 0;
    match.roundScores[m.id] = [];
  }

  activeMatches.set(matchId, match);

  // Start first phase
  startPhase(match);

  return match;
}

/**
 * Get an active match by ID.
 */
export function getActiveMatch(matchId: string): ActiveMatch | undefined {
  return activeMatches.get(matchId);
}

/**
 * Start a phase: set deadline, emit event, schedule auto-advance.
 */
function startPhase(match: ActiveMatch): void {
  const duration = PHASE_DURATIONS_MS[match.phase] || 0;
  const now = new Date();

  if (duration > 0) {
    match.phaseDeadline = new Date(now.getTime() + duration);
    // Auto-advance when deadline expires
    match.phaseTimer = setTimeout(() => advancePhase(match), duration);
  } else {
    match.phaseDeadline = null;
  }

  // Emit phase transition event
  const event = {
    type: 'phase_transition',
    matchId: match.id,
    round: match.round,
    fromPhase: match.phase, // Will be current on first call
    toPhase: match.phase,
    deadline: match.phaseDeadline?.toISOString() || null,
    timestamp: now.toISOString(),
  };

  emitToMatch(match.id, event);

  try {
    appendEvent(match.id, 'phase_transition', event);
  } catch {
    // DB may not be initialized in tests
  }

  // For bot actions in bid/equip phases, auto-submit after short delay
  if (match.phase === 'hidden_bid' || match.phase === 'equip') {
    setTimeout(() => autoSubmitBotActions(match), 500);
  }

  // For instant phases (bid_resolve, resolve), auto-advance after brief display
  if (match.phase === 'bid_resolve') {
    // Reveal bids then advance
    if (match.phaseTimer) clearTimeout(match.phaseTimer);
    match.phaseTimer = setTimeout(() => advancePhase(match), PHASE_DURATIONS_MS.bid_resolve);
  }

  if (match.phase === 'run') {
    // Simulate run completion with mock results
    if (match.phaseTimer) clearTimeout(match.phaseTimer);
    const runDuration = 2000; // Mock: 2s instead of full 60s
    match.phaseTimer = setTimeout(() => {
      generateMockRunResults(match);
      advancePhase(match);
    }, runDuration);
  }
}

/**
 * Advance to the next phase or round.
 */
function advancePhase(match: ActiveMatch): void {
  if (match.status === 'completed') return;
  if (match.phaseTimer) {
    clearTimeout(match.phaseTimer);
    match.phaseTimer = null;
  }

  const fromPhase = match.phase;

  // Determine next phase
  const phaseIndex = PHASES.indexOf(match.phase as RoundPhase);

  if (match.phase === 'final_standings') {
    return; // Terminal
  }

  if (phaseIndex === PHASES.length - 1) {
    // End of round (resolve)
    clearRoundCache(match.id, match.round);

    if (match.round >= TOTAL_ROUNDS) {
      // Match complete -> final standings
      match.phase = 'final_standings';
      match.status = 'completed';
      emitFinalStandings(match);
      return;
    }
    // Next round
    match.round += 1;
    match.phase = 'briefing';
    match.bids.clear();
    match.equips.clear();
  } else {
    match.phase = PHASES[phaseIndex + 1];
  }

  // Emit transition
  const transitionEvent = {
    type: 'phase_transition',
    matchId: match.id,
    round: match.round,
    fromPhase,
    toPhase: match.phase,
    deadline: null as string | null,
    timestamp: new Date().toISOString(),
  };

  emitToMatch(match.id, transitionEvent);
  try {
    appendEvent(match.id, 'phase_transition', transitionEvent);
  } catch {
    // DB may not be initialized
  }

  startPhase(match);
}

/**
 * Submit a bid for a manager.
 */
export function submitBid(matchId: string, managerId: string, amount: number): boolean {
  const match = activeMatches.get(matchId);
  if (!match || match.phase !== 'hidden_bid') return false;
  match.bids.set(managerId, amount);
  return true;
}

/**
 * Submit equip selections for a manager.
 */
export function submitEquip(
  matchId: string,
  managerId: string,
  tools: string[],
  hazards: string[],
): boolean {
  const match = activeMatches.get(matchId);
  if (!match || match.phase !== 'equip') return false;
  match.equips.set(managerId, { tools, hazards });
  return true;
}

// === Runner Result Application ===

/** Result of applying a runner result to a match. */
export interface ApplyRunnerResultOutcome {
  readonly success: boolean;
  readonly error?: string;
  readonly managerId: string;
  readonly round: number;
  readonly scoreResult?: ScoreResult;
}

/**
 * Apply a real runner result to the match state.
 *
 * This function:
 *  1. Validates the runner result belongs to an active match in the run/resolve phase.
 *  2. Scores the result using game-core's scoring engine (with correctness gate).
 *  3. Updates the match scores and roundScores.
 *  4. Emits a scored event over WebSocket.
 *
 * CORRECTNESS GATE: Failed submissions (success=false) or zero-pass results
 * receive exactly 0 points via scoreRunnerResult.
 *
 * @param runnerResult - The completed runner result from harness execution.
 * @returns            - Outcome indicating success or failure with details.
 */
export function applyRunnerResult(runnerResult: RunnerResult): ApplyRunnerResultOutcome {
  const match = activeMatches.get(runnerResult.matchId);

  if (!match) {
    return {
      success: false,
      error: 'Match not found',
      managerId: runnerResult.agentId,
      round: runnerResult.round,
    };
  }

  if (match.status !== 'active') {
    return {
      success: false,
      error: 'Match is not active',
      managerId: runnerResult.agentId,
      round: runnerResult.round,
    };
  }

  // Verify the runner result is for the current round
  if (runnerResult.round !== match.round) {
    return {
      success: false,
      error: `Round mismatch: expected ${match.round}, got ${runnerResult.round}`,
      managerId: runnerResult.agentId,
      round: runnerResult.round,
    };
  }

  // Verify the agent belongs to this match
  const manager = match.managers.find((m) => m.id === runnerResult.agentId);
  if (!manager) {
    return {
      success: false,
      error: 'Agent not found in match',
      managerId: runnerResult.agentId,
      round: runnerResult.round,
    };
  }

  // Score the result using game-core scoring engine (applies correctness gate)
  const { scoreResult } = scoreRunnerResult(runnerResult);

  // Update match state with the scored result
  if (!match.roundScores[runnerResult.agentId]) {
    match.roundScores[runnerResult.agentId] = [];
  }

  // Pad roundScores if needed (in case earlier rounds weren't recorded)
  while (match.roundScores[runnerResult.agentId].length < runnerResult.round - 1) {
    match.roundScores[runnerResult.agentId].push(0);
  }

  match.roundScores[runnerResult.agentId][runnerResult.round - 1] = scoreResult.totalScore;

  // Recalculate total score from all round scores
  match.scores[runnerResult.agentId] = match.roundScores[runnerResult.agentId].reduce(
    (sum, s) => sum + s,
    0,
  );

  // Emit scored event
  const scoredEvent = {
    type: 'submission_scored',
    matchId: match.id,
    round: runnerResult.round,
    managerId: runnerResult.agentId,
    scoreResult: {
      correctness: scoreResult.correctness,
      baseScore: scoreResult.baseScore,
      latencyFactor: scoreResult.latencyFactor,
      resourceFactor: scoreResult.resourceFactor,
      llmBonus: scoreResult.llmBonus,
      totalScore: scoreResult.totalScore,
    },
    standings: { ...match.scores },
    timestamp: new Date().toISOString(),
  };

  emitToMatch(match.id, scoredEvent);
  try {
    appendEvent(match.id, 'submission_scored', scoredEvent);
  } catch {
    // DB may not be initialized in tests
  }

  return {
    success: true,
    managerId: runnerResult.agentId,
    round: runnerResult.round,
    scoreResult,
  };
}

/**
 * Auto-submit bot actions with deterministic values.
 */
function autoSubmitBotActions(match: ActiveMatch): void {
  const bots = match.managers.filter((m) => m.role === 'bot');

  if (match.phase === 'hidden_bid') {
    for (const bot of bots) {
      if (!match.bids.has(bot.id)) {
        // Simple deterministic bid: round * 10 + bot index * 5
        const botIndex = match.managers.indexOf(bot);
        const bid = match.round * 10 + botIndex * 5;
        match.bids.set(bot.id, bid);
      }
    }
  }

  if (match.phase === 'equip') {
    for (const bot of bots) {
      if (!match.equips.has(bot.id)) {
        match.equips.set(bot.id, { tools: [], hazards: [] });
      }
    }
  }
}

/**
 * Generate mock run results (will be replaced by real runner in E4).
 */
function generateMockRunResults(match: ActiveMatch): void {
  for (const manager of match.managers) {
    // Mock score: deterministic based on round and manager index
    const managerIndex = match.managers.indexOf(manager);
    const mockScore = 500 + match.round * 50 + managerIndex * 25;

    if (!match.roundScores[manager.id]) {
      match.roundScores[manager.id] = [];
    }
    match.roundScores[manager.id].push(mockScore);
    match.scores[manager.id] = (match.scores[manager.id] || 0) + mockScore;
  }

  // Emit round result
  const roundResultEvent = {
    type: 'round_result',
    matchId: match.id,
    round: match.round,
    results: match.managers.map((m) => ({
      managerId: m.id,
      score: match.roundScores[m.id]![match.round - 1],
      correctness: 0.8 + Math.random() * 0.2, // Mock
    })),
    standings: { ...match.scores },
    timestamp: new Date().toISOString(),
  };

  emitToMatch(match.id, roundResultEvent);
  try {
    appendEvent(match.id, 'round_result', roundResultEvent);
  } catch {
    // DB may not be initialized
  }
}

/**
 * Emit final standings and match_complete events.
 */
function emitFinalStandings(match: ActiveMatch): void {
  // Sort by total score descending
  const sorted = [...match.managers]
    .map((m) => ({
      managerId: m.id,
      managerName: m.name,
      totalScore: match.scores[m.id] || 0,
      roundScores: match.roundScores[m.id] || [],
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  const standingsEvent = {
    type: 'final_standings',
    matchId: match.id,
    standings: sorted,
    timestamp: new Date().toISOString(),
  };

  const completeEvent = {
    type: 'match_complete',
    matchId: match.id,
    timestamp: new Date().toISOString(),
  };

  emitToMatch(match.id, standingsEvent);
  emitToMatch(match.id, completeEvent);

  try {
    appendEvent(match.id, 'final_standings', standingsEvent);
    appendEvent(match.id, 'match_complete', completeEvent);
  } catch {
    // DB may not be initialized
  }
}

/**
 * Get match state as API response.
 */
export function getMatchState(matchId: string) {
  const match = activeMatches.get(matchId);
  if (!match) return null;

  return {
    id: match.id,
    seed: match.seed,
    status: match.status,
    currentRound: match.round,
    currentPhase: match.phase,
    managers: match.managers,
    scores: match.scores,
    phaseDeadline: match.phaseDeadline?.toISOString() || null,
    createdAt: new Date().toISOString(),
  };
}
