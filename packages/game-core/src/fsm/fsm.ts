import seedrandom from 'seedrandom';
import {
  PHASES,
  TOTAL_ROUNDS,
  type MatchFsmState,
  type FsmTransitionAction,
  type FsmTransitionResult,
  type MatchPhase,
  type RoundPhase,
  InvalidTransitionError,
} from './types.js';

/**
 * Create initial FSM state for a new match.
 * Pure function — no side effects.
 */
export function createInitialState(seed: string): MatchFsmState {
  const rng = seedrandom(seed, { state: true });
  // Advance RNG once to initialize state
  rng();
  return {
    round: 1,
    phase: 'briefing',
    seed,
    rngState: JSON.stringify(rng.state()),
    isTerminal: false,
  };
}

/**
 * Get the next phase in the sequence.
 * Returns null if no valid next phase (shouldn't happen for valid states).
 */
function getNextPhase(
  currentPhase: MatchPhase,
  currentRound: number,
): { phase: MatchPhase; round: number } | null {
  if (currentPhase === 'final_standings') {
    return null; // Terminal state
  }

  const phaseIndex = PHASES.indexOf(currentPhase as RoundPhase);
  if (phaseIndex === -1) {
    return null;
  }

  // If we're at the last phase of a round ('resolve')
  if (phaseIndex === PHASES.length - 1) {
    if (currentRound >= TOTAL_ROUNDS) {
      // After round 5 resolve → final standings
      return { phase: 'final_standings', round: currentRound };
    }
    // Move to next round's briefing
    return { phase: 'briefing', round: currentRound + 1 };
  }

  // Move to next phase in current round
  return { phase: PHASES[phaseIndex + 1], round: currentRound };
}

/**
 * Advance the FSM state by one transition.
 * Pure function — returns new state without mutating input.
 * Throws InvalidTransitionError for invalid transitions.
 */
export function advanceFsm(
  state: MatchFsmState,
  _action: FsmTransitionAction,
): FsmTransitionResult {
  if (state.isTerminal) {
    throw new InvalidTransitionError(
      state.phase,
      state.round,
      'Match is in terminal state (final_standings)',
    );
  }

  const next = getNextPhase(state.phase, state.round);
  if (!next) {
    throw new InvalidTransitionError(
      state.phase,
      state.round,
      'No valid next phase from current state',
    );
  }

  // Restore and advance RNG for deterministic state progression
  const rng = seedrandom('', { state: JSON.parse(state.rngState) });
  rng(); // Advance RNG on each transition
  const newRngState = JSON.stringify(rng.state());

  const newState: MatchFsmState = {
    round: next.round,
    phase: next.phase,
    seed: state.seed,
    rngState: newRngState,
    isTerminal: next.phase === 'final_standings',
  };

  return {
    state: newState,
    transition: {
      fromRound: state.round,
      fromPhase: state.phase,
      toRound: next.round,
      toPhase: next.phase,
    },
  };
}

/**
 * Get the current seeded RNG value without advancing FSM state.
 * Useful for deterministic decisions within a phase (e.g., tie-breaking).
 */
export function getRngValue(state: MatchFsmState): number {
  const rng = seedrandom('', { state: JSON.parse(state.rngState) });
  return rng();
}

/**
 * Validate that a given phase transition sequence is valid.
 * Useful for replay validation.
 */
export function isValidTransition(
  from: MatchPhase,
  fromRound: number,
  to: MatchPhase,
  toRound: number,
): boolean {
  const next = getNextPhase(from, fromRound);
  if (!next) return false;
  return next.phase === to && next.round === toRound;
}

/**
 * Run a complete match simulation from initial state to final standings.
 * Returns all intermediate states. Pure function.
 */
export function simulateFullMatch(seed: string): MatchFsmState[] {
  const states: MatchFsmState[] = [];
  let current = createInitialState(seed);
  states.push(current);

  while (!current.isTerminal) {
    const result = advanceFsm(current, { type: 'ADVANCE_PHASE' });
    current = result.state;
    states.push(current);
  }

  return states;
}
