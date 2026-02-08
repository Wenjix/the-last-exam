export const PHASES = ['briefing', 'bidding', 'strategy', 'execution', 'scoring'] as const;

export type RoundPhase = (typeof PHASES)[number];
export type TerminalPhase = 'final_standings';
export type MatchPhase = RoundPhase | TerminalPhase;

export const TOTAL_ROUNDS = 5;

export interface MatchFsmState {
  readonly round: number;
  readonly phase: MatchPhase;
  readonly seed: string;
  readonly rngState: string;
  readonly isTerminal: boolean;
}

export type FsmTransitionAction =
  | { type: 'ADVANCE_PHASE' }
  | { type: 'FORCE_ADVANCE'; reason: string };

export interface FsmTransitionResult {
  readonly state: MatchFsmState;
  readonly transition: {
    readonly fromRound: number;
    readonly fromPhase: MatchPhase;
    readonly toRound: number;
    readonly toPhase: MatchPhase;
  };
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly currentPhase: MatchPhase,
    public readonly currentRound: number,
    public readonly reason: string,
  ) {
    super(`Invalid transition from ${currentPhase} (round ${currentRound}): ${reason}`);
    this.name = 'InvalidTransitionError';
  }
}
