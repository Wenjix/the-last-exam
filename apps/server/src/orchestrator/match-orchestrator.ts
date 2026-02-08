import { v4 as uuidv4 } from 'uuid';
import type { RunnerResult } from '@tle/contracts';
import { resolveSealedBid, scoreRunnerResult } from '@tle/game-core';
import type { ScoreResult, BudgetBidEntry } from '@tle/game-core';
import { getRoundAssignments } from '@tle/content';
import type { RoundAssignment } from '@tle/content';
import { generateBotBudgetBid, generateBotStrategy, DEFAULT_BOT_CONFIGS } from '@tle/ai';
import type { BotPersonality } from '@tle/ai';
import { CommentaryGenerator } from '@tle/audio';
import type { CommentaryEvent } from '@tle/audio';
import { emitToMatch } from '../ws/event-stream.js';
import { appendEvent } from '../persistence/event-store.js';
import { clearRoundCache } from '../middleware/idempotency.js';

// === Commentary Generator (module-level, shared across all matches) ===

const commentaryGen = new CommentaryGenerator();
commentaryGen.onCommentary((output) => {
  emitToMatch(output.matchId, {
    type: 'commentary_update',
    matchId: output.matchId,
    text: output.text,
    round: output.round,
    language: output.language,
    timestamp: output.timestamp,
  });
});

// === Types ===

const PHASES = ['briefing', 'bidding', 'strategy', 'execution', 'scoring'] as const;
type RoundPhase = (typeof PHASES)[number];
type TerminalPhase = 'final_standings';
type MatchPhase = RoundPhase | TerminalPhase;

const TOTAL_ROUNDS = 5;
const INITIAL_BUDGET = 100;

const PHASE_DURATIONS_MS: Record<string, number> = {
  briefing: 5_000,
  bidding: 5_000,
  strategy: 10_000,
  execution: 10_000, // Mock streaming: 10s to show code generation + test results
  scoring: 5_000,
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
  roundAssignments: RoundAssignment[];
  phaseDeadline: Date | null;
  phaseTimer: ReturnType<typeof setTimeout> | null;
  budgets: Record<string, number>;
  bids: Map<string, number>;
  strategies: Map<string, string>;
  dataCardWinner: string | null;
}

const activeMatches = new Map<string, ActiveMatch>();

// === Orchestrator ===

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
    roundAssignments: getRoundAssignments(matchSeed),
    phaseDeadline: null,
    phaseTimer: null,
    budgets: {},
    bids: new Map(),
    strategies: new Map(),
    dataCardWinner: null,
  };

  for (const m of managers) {
    match.scores[m.id] = 0;
    match.roundScores[m.id] = [];
    match.budgets[m.id] = INITIAL_BUDGET;
  }

  activeMatches.set(matchId, match);
  startPhase(match);
  return match;
}

export function getActiveMatch(matchId: string): ActiveMatch | undefined {
  return activeMatches.get(matchId);
}

function computeRanks(match: ActiveMatch): Record<string, number> {
  const sorted = [...match.managers].sort(
    (a, b) => (match.scores[b.id] ?? 0) - (match.scores[a.id] ?? 0),
  );
  const ranks: Record<string, number> = {};
  sorted.forEach((m, i) => {
    ranks[m.id] = i + 1;
  });
  return ranks;
}

function getBotPersonality(bot: ManagerState): BotPersonality {
  const config = DEFAULT_BOT_CONFIGS.find((c) => c.displayName === bot.name);
  return config?.personality ?? 'aggressive';
}

/**
 * Start a phase: set deadline, emit event, schedule auto-advance.
 */
function startPhase(match: ActiveMatch, fromPhase?: MatchPhase): void {
  const duration = PHASE_DURATIONS_MS[match.phase] || 0;
  const now = new Date();

  if (duration > 0) {
    match.phaseDeadline = new Date(now.getTime() + duration);
    match.phaseTimer = setTimeout(() => advancePhase(match), duration);
  } else {
    match.phaseDeadline = null;
  }

  const assignment = match.roundAssignments[match.round - 1];
  const event: Record<string, unknown> = {
    type: 'phase_transition',
    matchId: match.id,
    round: match.round,
    fromPhase: fromPhase ?? match.phase,
    toPhase: match.phase,
    deadline: match.phaseDeadline?.toISOString() || null,
    timestamp: now.toISOString(),
  };

  // Briefing: include challenge + data card preview + budgets
  if (match.phase === 'briefing' && assignment) {
    event.challengeTitle = assignment.challenge.title;
    event.challengeDescription = assignment.challenge.description;
    event.difficulty = assignment.challenge.difficulty;
    event.dataCard = {
      id: assignment.dataCard.id,
      title: assignment.dataCard.title,
      description: assignment.dataCard.description,
    };
    event.budgets = { ...match.budgets };
  }

  // Bidding: data card info + budgets
  if (match.phase === 'bidding' && assignment) {
    event.dataCard = {
      id: assignment.dataCard.id,
      title: assignment.dataCard.title,
      description: assignment.dataCard.description,
    };
    event.budgets = { ...match.budgets };
  }

  // Strategy: include bid result info
  if (match.phase === 'strategy') {
    event.budgets = { ...match.budgets };
    if (match.dataCardWinner) {
      const winner = match.managers.find((m) => m.id === match.dataCardWinner);
      event.bidWinner = {
        managerId: match.dataCardWinner,
        managerName: winner?.name ?? 'Unknown',
        amount: match.bids.get(match.dataCardWinner) ?? 0,
      };
    } else {
      event.bidWinner = null;
    }
    // Include all bids (revealed after bidding)
    event.allBids = [...match.bids.entries()].map(([managerId, amount]) => ({
      managerId,
      managerName: match.managers.find((m) => m.id === managerId)?.name ?? 'Unknown',
      amount,
    }));
  }

  emitToMatch(match.id, event);
  commentaryGen.processEvent(event as CommentaryEvent);

  try {
    appendEvent(match.id, 'phase_transition', event);
  } catch {
    // DB may not be initialized in tests
  }

  // Auto-submit bot actions for bidding and strategy phases
  if (match.phase === 'bidding' || match.phase === 'strategy') {
    setTimeout(() => autoSubmitBotActions(match), 500);
  }

  // Execution: stream mock code generation + test results before advancing
  if (match.phase === 'execution') {
    if (match.phaseTimer) clearTimeout(match.phaseTimer);
    emitMockAgentStreams(match, () => {
      generateMockRunResults(match);
      advancePhase(match);
    });
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

  // Resolve sealed bid when transitioning from bidding to strategy
  if (fromPhase === 'bidding') {
    resolveBidding(match);
  }

  const phaseIndex = PHASES.indexOf(match.phase as RoundPhase);

  if (match.phase === 'final_standings') {
    return; // Terminal
  }

  if (phaseIndex === PHASES.length - 1) {
    // End of round (scoring)
    clearRoundCache(match.id, match.round);

    if (match.round >= TOTAL_ROUNDS) {
      match.phase = 'final_standings';
      match.status = 'completed';
      emitFinalStandings(match);
      return;
    }
    // Next round — clear per-round state
    match.round += 1;
    match.phase = 'briefing';
    match.bids.clear();
    match.strategies.clear();
    match.dataCardWinner = null;
  } else {
    match.phase = PHASES[phaseIndex + 1];
  }

  startPhase(match, fromPhase);
}

/**
 * Resolve the sealed bid auction and update budgets.
 */
function resolveBidding(match: ActiveMatch): void {
  const ranks = computeRanks(match);

  const bidEntries: BudgetBidEntry[] = match.managers.map((m) => ({
    managerId: m.id,
    amount: match.bids.get(m.id) ?? 0,
    currentRank: ranks[m.id] ?? match.managers.length,
    remainingBudget: match.budgets[m.id] ?? 0,
  }));

  const result = resolveSealedBid(bidEntries, `${match.seed}:r${match.round}`);

  // Update budgets
  for (const [managerId, budget] of Object.entries(result.updatedBudgets)) {
    match.budgets[managerId] = budget;
  }

  match.dataCardWinner = result.winnerId;
}

/**
 * Submit a bid for a manager (data card auction).
 */
export function submitBid(matchId: string, managerId: string, amount: number): boolean {
  const match = activeMatches.get(matchId);
  if (!match || match.phase !== 'bidding') return false;

  // Validate bid is within budget
  const budget = match.budgets[managerId] ?? 0;
  if (amount > budget) return false;

  match.bids.set(managerId, amount);

  emitToMatch(matchId, {
    type: 'bid_submitted',
    matchId,
    managerId,
    round: match.round,
    timestamp: new Date().toISOString(),
  });

  return true;
}

/**
 * Submit a strategy prompt for a manager.
 */
export function submitStrategy(matchId: string, managerId: string, prompt: string): boolean {
  const match = activeMatches.get(matchId);
  if (!match || match.phase !== 'strategy') return false;

  match.strategies.set(managerId, prompt);

  emitToMatch(matchId, {
    type: 'strategy_submitted',
    matchId,
    managerId,
    round: match.round,
    timestamp: new Date().toISOString(),
  });

  return true;
}

// === Runner Result Application ===

export interface ApplyRunnerResultOutcome {
  readonly success: boolean;
  readonly error?: string;
  readonly managerId: string;
  readonly round: number;
  readonly scoreResult?: ScoreResult;
}

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

  if (runnerResult.round !== match.round) {
    return {
      success: false,
      error: `Round mismatch: expected ${match.round}, got ${runnerResult.round}`,
      managerId: runnerResult.agentId,
      round: runnerResult.round,
    };
  }

  const manager = match.managers.find((m) => m.id === runnerResult.agentId);
  if (!manager) {
    return {
      success: false,
      error: 'Agent not found in match',
      managerId: runnerResult.agentId,
      round: runnerResult.round,
    };
  }

  const { scoreResult } = scoreRunnerResult(runnerResult);

  if (!match.roundScores[runnerResult.agentId]) {
    match.roundScores[runnerResult.agentId] = [];
  }

  while (match.roundScores[runnerResult.agentId].length < runnerResult.round - 1) {
    match.roundScores[runnerResult.agentId].push(0);
  }

  match.roundScores[runnerResult.agentId][runnerResult.round - 1] = scoreResult.totalScore;

  match.scores[runnerResult.agentId] = match.roundScores[runnerResult.agentId].reduce(
    (sum, s) => sum + s,
    0,
  );

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
  const ranks = computeRanks(match);

  if (match.phase === 'bidding') {
    for (const bot of bots) {
      if (!match.bids.has(bot.id)) {
        const personality = getBotPersonality(bot);
        const bid = generateBotBudgetBid(
          personality,
          {
            round: match.round,
            totalRounds: TOTAL_ROUNDS,
            currentRank: ranks[bot.id] ?? match.managers.length,
            totalManagers: match.managers.length,
            remainingBudget: match.budgets[bot.id] ?? 0,
          },
          match.seed,
        );
        match.bids.set(bot.id, bid);
      }
    }
  }

  if (match.phase === 'strategy') {
    for (const bot of bots) {
      if (!match.strategies.has(bot.id)) {
        const personality = getBotPersonality(bot);
        const strategy = generateBotStrategy({
          personality,
          round: match.round,
          totalRounds: TOTAL_ROUNDS,
          currentRank: ranks[bot.id] ?? match.managers.length,
          hasDataCard: match.dataCardWinner === bot.id,
          seed: match.seed,
        });
        match.strategies.set(bot.id, strategy);
      }
    }
  }
}

// === Mock Streaming Code Snippets ===

const MOCK_CODE_SOLUTIONS: string[][] = [
  // Solution style 0: clean functional
  [
    'def solve(nums, target):',
    '    seen = {}',
    '    for i, num in enumerate(nums):',
    '        complement = target - num',
    '        if complement in seen:',
    '            return [seen[complement], i]',
    '        seen[num] = i',
    '    return []',
    '',
    'def main():',
    '    import sys',
    '    data = sys.stdin.read().split()',
    '    n = int(data[0])',
    '    nums = [int(x) for x in data[1:n+1]]',
    '    target = int(data[n+1])',
    '    result = solve(nums, target)',
    '    print(" ".join(map(str, result)))',
    '',
    'if __name__ == "__main__":',
    '    main()',
  ],
  // Solution style 1: class-based OOP
  [
    'class Solution:',
    '    def __init__(self):',
    '        self.memo = {}',
    '',
    '    def solve(self, data, n):',
    '        if n in self.memo:',
    '            return self.memo[n]',
    '        if n <= 1:',
    '            return n',
    '        result = self.solve(data, n-1) + self.solve(data, n-2)',
    '        self.memo[n] = result',
    '        return result',
    '',
    '    def run(self, input_str):',
    '        lines = input_str.strip().split("\\n")',
    '        n = int(lines[0])',
    '        return str(self.solve(None, n))',
    '',
    'import sys',
    'sol = Solution()',
    'print(sol.run(sys.stdin.read()))',
  ],
  // Solution style 2: iterative with stack
  [
    'import sys',
    'from collections import deque',
    '',
    'def process(s):',
    '    stack = deque()',
    '    mapping = {")": "(", "}": "{", "]": "["}',
    '    for char in s:',
    '        if char in mapping:',
    '            top = stack.pop() if stack else "#"',
    '            if mapping[char] != top:',
    '                return False',
    '        else:',
    '            stack.append(char)',
    '    return not stack',
    '',
    'data = sys.stdin.read().strip().split("\\n")',
    'for line in data[1:]:',
    '    print("true" if process(line) else "false")',
  ],
  // Solution style 3: brute-force then optimize
  [
    '# brute force approach first',
    'def solve_naive(arr):',
    '    n = len(arr)',
    '    best = 1',
    '    for i in range(n):',
    '        for j in range(i+1, n):',
    '            if arr[j] > arr[i]:',
    '                best = max(best, 2)',
    '    return best',
    '',
    '# optimized with binary search',
    'from bisect import bisect_left',
    '',
    'def solve(arr):',
    '    tails = []',
    '    for x in arr:',
    '        pos = bisect_left(tails, x)',
    '        if pos == len(tails):',
    '            tails.append(x)',
    '        else:',
    '            tails[pos] = x',
    '    return len(tails)',
    '',
    'import sys',
    'data = sys.stdin.read().split()',
    'n = int(data[0])',
    'arr = [int(x) for x in data[1:n+1]]',
    'print(solve(arr))',
  ],
];

/**
 * Emit mock agent streaming events during execution phase.
 * Simulates 4 agents writing code at different speeds, then running tests.
 */
function emitMockAgentStreams(match: ActiveMatch, onComplete: () => void): void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const totalTests = 5;
  let completedAgents = 0;
  let phaseAdvanced = false;

  // Guard against double-firing (clearTimeout may not work with fake timers in tests)
  function safeOnComplete() {
    if (phaseAdvanced || match.status !== 'active') return;
    phaseAdvanced = true;
    onComplete();
  }

  for (let i = 0; i < match.managers.length; i++) {
    const manager = match.managers[i];
    const codeLines = MOCK_CODE_SOLUTIONS[i % MOCK_CODE_SOLUTIONS.length];

    // Vary speed per agent: 80-150ms per line
    const lineDelay = 80 + (i * 25);
    // Stagger start: 0-600ms offset
    const startOffset = i * 200;

    // 1) Emit agent_stream_start
    const startTimer = setTimeout(() => {
      if (match.status !== 'active') return;
      emitToMatch(match.id, {
        type: 'agent_stream_start',
        matchId: match.id,
        managerId: manager.id,
        round: match.round,
        language: 'python',
        timestamp: new Date().toISOString(),
      });
    }, startOffset);
    timers.push(startTimer);

    // 2) Emit code chunks line by line
    const codeStartTime = startOffset + 300;
    for (let lineIdx = 0; lineIdx < codeLines.length; lineIdx++) {
      const chunkTimer = setTimeout(() => {
        if (match.status !== 'active') return;
        emitToMatch(match.id, {
          type: 'agent_stream_chunk',
          matchId: match.id,
          managerId: manager.id,
          round: match.round,
          chunkType: 'code',
          content: codeLines[lineIdx] + '\n',
          lineNumber: lineIdx + 1,
          timestamp: new Date().toISOString(),
        });
      }, codeStartTime + lineIdx * lineDelay);
      timers.push(chunkTimer);
    }

    // 3) Emit test results after code is done
    const testsStartTime = codeStartTime + codeLines.length * lineDelay + 500;
    const isDataCardWinner = manager.id === match.dataCardWinner;

    for (let testIdx = 0; testIdx < totalTests; testIdx++) {
      const testTimer = setTimeout(() => {
        if (match.status !== 'active') return;
        // Most tests pass; agent index affects which might fail
        const passed = testIdx < 3 || isDataCardWinner || (i + testIdx) % 4 !== 0;
        emitToMatch(match.id, {
          type: 'agent_stream_test_result',
          matchId: match.id,
          managerId: manager.id,
          round: match.round,
          testIndex: testIdx,
          totalTests,
          passed,
          errorMessage: passed ? undefined : 'assertion error: expected 42, got -1',
          timestamp: new Date().toISOString(),
        });
      }, testsStartTime + testIdx * 300);
      timers.push(testTimer);
    }

    // 4) Emit agent_stream_complete after all tests
    const completeTime = testsStartTime + totalTests * 300 + 200;
    const completeTimer = setTimeout(() => {
      if (match.status !== 'active') return;
      const testsPassed = isDataCardWinner ? totalTests : totalTests - (i % 2 === 0 && i > 0 ? 1 : 0);
      emitToMatch(match.id, {
        type: 'agent_stream_complete',
        matchId: match.id,
        managerId: manager.id,
        round: match.round,
        success: testsPassed === totalTests,
        totalLines: codeLines.length,
        testsPassed,
        testsTotal: totalTests,
        durationMs: completeTime - startOffset,
        timestamp: new Date().toISOString(),
      });

      completedAgents++;
      if (completedAgents === match.managers.length) {
        // All agents done — advance after a brief pause
        const advanceTimer = setTimeout(safeOnComplete, 500);
        timers.push(advanceTimer);
      }
    }, completeTime);
    timers.push(completeTimer);
  }

  // Safety: set a hard deadline in case something goes wrong
  const hardDeadline = setTimeout(() => {
    if (completedAgents < match.managers.length) {
      safeOnComplete();
    }
  }, PHASE_DURATIONS_MS.execution);
  timers.push(hardDeadline);

  // Store timer so phase advance can clear it
  match.phaseTimer = hardDeadline;
}

/**
 * Generate mock run results.
 */
function generateMockRunResults(match: ActiveMatch): void {
  for (const manager of match.managers) {
    const managerIndex = match.managers.indexOf(manager);
    let mockScore = 500 + match.round * 50 + managerIndex * 25;

    // Data card winner gets a slight bonus
    if (manager.id === match.dataCardWinner) {
      mockScore += 50;
    }

    if (!match.roundScores[manager.id]) {
      match.roundScores[manager.id] = [];
    }
    match.roundScores[manager.id].push(mockScore);
    match.scores[manager.id] = (match.scores[manager.id] || 0) + mockScore;
  }

  const roundResultEvent = {
    type: 'round_result',
    matchId: match.id,
    round: match.round,
    results: match.managers.map((m) => ({
      managerId: m.id,
      score: match.roundScores[m.id]![match.round - 1],
      correctness: 0.8 + Math.random() * 0.2,
    })),
    standings: { ...match.scores },
    timestamp: new Date().toISOString(),
  };

  emitToMatch(match.id, roundResultEvent);
  commentaryGen.processEvent(roundResultEvent as unknown as CommentaryEvent);

  try {
    appendEvent(match.id, 'round_result', roundResultEvent);
  } catch {
    // DB may not be initialized
  }
}

function emitFinalStandings(match: ActiveMatch): void {
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
  commentaryGen.processEvent(standingsEvent as unknown as CommentaryEvent);

  try {
    appendEvent(match.id, 'final_standings', standingsEvent);
    appendEvent(match.id, 'match_complete', completeEvent);
  } catch {
    // DB may not be initialized
  }
}

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
    budgets: match.budgets,
    phaseDeadline: match.phaseDeadline?.toISOString() || null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build a phase_transition event reflecting the current match state.
 * Used to sync late-joining clients so they don't miss challenge info.
 */
export function getCurrentPhaseEvent(matchId: string): Record<string, unknown> | null {
  const match = activeMatches.get(matchId);
  if (!match) return null;

  const assignment = match.roundAssignments[match.round - 1];
  const event: Record<string, unknown> = {
    type: 'phase_transition',
    matchId: match.id,
    round: match.round,
    fromPhase: match.phase,
    toPhase: match.phase,
    deadline: match.phaseDeadline?.toISOString() || null,
    budgets: { ...match.budgets },
    timestamp: new Date().toISOString(),
  };

  if (assignment) {
    event.challengeTitle = assignment.challenge.title;
    event.challengeDescription = assignment.challenge.description;
    event.difficulty = assignment.challenge.difficulty;
    event.dataCard = {
      id: assignment.dataCard.id,
      title: assignment.dataCard.title,
      description: assignment.dataCard.description,
    };
  }

  if (match.dataCardWinner) {
    const winner = match.managers.find((m) => m.id === match.dataCardWinner);
    event.bidWinner = {
      managerId: match.dataCardWinner,
      managerName: winner?.name ?? 'Unknown',
      amount: match.bids.get(match.dataCardWinner) ?? 0,
    };
  }

  return event;
}
