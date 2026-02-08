/**
 * Tests for harness-first scoring with correctness gating.
 * Issue: 5li.1
 *
 * Covers:
 * - scoreRunnerResult: correctness gate, proportional scoring, edge cases
 * - runnerResultToHarnessInput: conversion from runner format to scoring input
 * - scoreResultToBreakdown: conversion from ScoreResult to ScoreBreakdown
 * - applyRunnerResult: match state integration
 */

import {
  scoreRunnerResult,
  runnerResultToHarnessInput,
  scoreResultToBreakdown,
  SCORING_CONFIG,
} from '../index.js';

import type { RunnerResult } from '@tle/contracts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid RunnerResult for testing. */
function makeRunnerResult(overrides: Partial<RunnerResult> = {}): RunnerResult {
  return {
    jobId: '00000000-0000-0000-0000-000000000001',
    matchId: '00000000-0000-0000-0000-000000000002',
    agentId: '00000000-0000-0000-0000-000000000003',
    round: 1,
    success: true,
    stdout: 'hello',
    stderr: '',
    submittedCode: 'console.log("hello")',
    harnessResults: [
      { testId: 't1', passed: true },
      { testId: 't2', passed: true },
    ],
    executionMetadata: {
      durationMs: 500,
      memoryUsedBytes: 1024,
      exitCode: 0,
      timedOut: false,
    },
    ...overrides,
  };
}

/** Build a runner result representing a failed submission (sandbox failure). */
function makeFailedResult(overrides: Partial<RunnerResult> = {}): RunnerResult {
  return makeRunnerResult({
    success: false,
    harnessResults: [],
    executionMetadata: {
      durationMs: 0,
      memoryUsedBytes: 0,
      exitCode: 1,
      timedOut: false,
    },
    failureReason: 'runtime_error',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// 1. runnerResultToHarnessInput
// ---------------------------------------------------------------------------
describe('runnerResultToHarnessInput', () => {
  it('converts all-pass harness results', () => {
    const result = makeRunnerResult({
      harnessResults: [
        { testId: 't1', passed: true },
        { testId: 't2', passed: true },
        { testId: 't3', passed: true },
      ],
      executionMetadata: {
        durationMs: 1500,
        memoryUsedBytes: 2048,
        exitCode: 0,
        timedOut: false,
      },
    });

    const harness = runnerResultToHarnessInput(result);
    expect(harness.totalTests).toBe(3);
    expect(harness.passedTests).toBe(3);
    expect(harness.durationMs).toBe(1500);
    expect(harness.memoryUsedBytes).toBe(2048);
  });

  it('converts partial-pass harness results', () => {
    const result = makeRunnerResult({
      harnessResults: [
        { testId: 't1', passed: true },
        { testId: 't2', passed: false },
        { testId: 't3', passed: true },
        { testId: 't4', passed: false },
      ],
    });

    const harness = runnerResultToHarnessInput(result);
    expect(harness.totalTests).toBe(4);
    expect(harness.passedTests).toBe(2);
  });

  it('converts all-fail harness results', () => {
    const result = makeRunnerResult({
      harnessResults: [
        { testId: 't1', passed: false },
        { testId: 't2', passed: false },
      ],
    });

    const harness = runnerResultToHarnessInput(result);
    expect(harness.totalTests).toBe(2);
    expect(harness.passedTests).toBe(0);
  });

  it('handles empty harness results', () => {
    const result = makeRunnerResult({ harnessResults: [] });
    const harness = runnerResultToHarnessInput(result);
    expect(harness.totalTests).toBe(0);
    expect(harness.passedTests).toBe(0);
  });

  it('uses memoryUsedBytes from execution metadata', () => {
    const result = makeRunnerResult({
      executionMetadata: {
        durationMs: 100,
        memoryUsedBytes: 999_999,
        exitCode: 0,
        timedOut: false,
      },
    });

    const harness = runnerResultToHarnessInput(result);
    expect(harness.memoryUsedBytes).toBe(999_999);
  });

  it('handles undefined memoryUsedBytes', () => {
    const result = makeRunnerResult({
      executionMetadata: {
        durationMs: 100,
        exitCode: 0,
        timedOut: false,
      },
    });

    const harness = runnerResultToHarnessInput(result);
    expect(harness.memoryUsedBytes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. scoreResultToBreakdown
// ---------------------------------------------------------------------------
describe('scoreResultToBreakdown', () => {
  it('maps all fields from ScoreResult to ScoreBreakdown', () => {
    const scoreResult = {
      correctness: 0.8,
      baseScore: 800,
      latencyFactor: 0.95,
      resourceFactor: 0.9,
      llmBonus: 50,
      totalScore: 850,
    };

    const breakdown = scoreResultToBreakdown(scoreResult);
    expect(breakdown.correctness).toBe(0.8);
    expect(breakdown.baseScore).toBe(800);
    expect(breakdown.latencyFactor).toBe(0.95);
    expect(breakdown.resourceFactor).toBe(0.9);
    expect(breakdown.llmBonus).toBe(50);
    expect(breakdown.totalScore).toBe(850);
  });

  it('maps zero score correctly', () => {
    const scoreResult = {
      correctness: 0,
      baseScore: 0,
      latencyFactor: 0,
      resourceFactor: 0,
      llmBonus: 0,
      totalScore: 0,
    };

    const breakdown = scoreResultToBreakdown(scoreResult);
    expect(breakdown.correctness).toBe(0);
    expect(breakdown.totalScore).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. scoreRunnerResult - Correctness Gate
// ---------------------------------------------------------------------------
describe('scoreRunnerResult', () => {
  describe('correctness gate: failed submissions', () => {
    it('returns zero score when success=false (sandbox failure)', () => {
      const result = makeFailedResult();
      const scored = scoreRunnerResult(result);

      expect(scored.scoreResult.totalScore).toBe(0);
      expect(scored.scoreResult.correctness).toBe(0);
      expect(scored.scoreResult.baseScore).toBe(0);
      expect(scored.scoreResult.latencyFactor).toBe(0);
      expect(scored.scoreResult.resourceFactor).toBe(0);
      expect(scored.scoreResult.llmBonus).toBe(0);
    });

    it('returns zero breakdown when success=false', () => {
      const result = makeFailedResult();
      const scored = scoreRunnerResult(result);

      expect(scored.scoreBreakdown.totalScore).toBe(0);
      expect(scored.scoreBreakdown.correctness).toBe(0);
    });

    it('returns zero for timeout failure', () => {
      const result = makeFailedResult({
        failureReason: 'timeout',
        executionMetadata: {
          durationMs: 60000,
          memoryUsedBytes: 0,
          exitCode: -1,
          timedOut: true,
        },
      });

      const scored = scoreRunnerResult(result);
      expect(scored.scoreResult.totalScore).toBe(0);
    });

    it('returns zero for compilation error', () => {
      const result = makeFailedResult({ failureReason: 'compilation_error' });
      const scored = scoreRunnerResult(result);
      expect(scored.scoreResult.totalScore).toBe(0);
    });

    it('returns zero for memory limit exceeded', () => {
      const result = makeFailedResult({ failureReason: 'memory_limit' });
      const scored = scoreRunnerResult(result);
      expect(scored.scoreResult.totalScore).toBe(0);
    });

    it('returns zero for sandbox error', () => {
      const result = makeFailedResult({ failureReason: 'sandbox_error' });
      const scored = scoreRunnerResult(result);
      expect(scored.scoreResult.totalScore).toBe(0);
    });

    it('returns zero when success=false even with passing harness results', () => {
      // Edge case: success=false but harness results show passes.
      // The correctness gate should still zero the score.
      const result = makeRunnerResult({
        success: false,
        harnessResults: [
          { testId: 't1', passed: true },
          { testId: 't2', passed: true },
        ],
      });

      const scored = scoreRunnerResult(result);
      expect(scored.scoreResult.totalScore).toBe(0);
      expect(scored.scoreResult.correctness).toBe(0);
    });

    it('returns zero when success=true but no harness results', () => {
      const result = makeRunnerResult({
        success: true,
        harnessResults: [],
      });

      const scored = scoreRunnerResult(result);
      expect(scored.scoreResult.totalScore).toBe(0);
    });

    it('ignores LLM bonus on failed submission', () => {
      const result = makeFailedResult();
      const scored = scoreRunnerResult(result, { rawScore: 1.0 });

      expect(scored.scoreResult.totalScore).toBe(0);
      expect(scored.scoreResult.llmBonus).toBe(0);
    });
  });

  describe('correctness gate: all tests fail', () => {
    it('returns zero score when all harness tests fail', () => {
      const result = makeRunnerResult({
        success: true,
        harnessResults: [
          { testId: 't1', passed: false },
          { testId: 't2', passed: false },
          { testId: 't3', passed: false },
        ],
      });

      const scored = scoreRunnerResult(result);
      expect(scored.scoreResult.totalScore).toBe(0);
      expect(scored.scoreResult.correctness).toBe(0);
      expect(scored.scoreResult.baseScore).toBe(0);
    });
  });

  describe('proportional scoring: correct submissions', () => {
    it('scores perfect submission (all tests pass, fast, low memory)', () => {
      const result = makeRunnerResult({
        harnessResults: [
          { testId: 't1', passed: true },
          { testId: 't2', passed: true },
          { testId: 't3', passed: true },
          { testId: 't4', passed: true },
          { testId: 't5', passed: true },
        ],
        executionMetadata: {
          durationMs: 0,
          memoryUsedBytes: 0,
          exitCode: 0,
          timedOut: false,
        },
      });

      const scored = scoreRunnerResult(result);
      expect(scored.scoreResult.correctness).toBe(1);
      expect(scored.scoreResult.baseScore).toBe(SCORING_CONFIG.MAX_BASE_SCORE);
      expect(scored.scoreResult.totalScore).toBe(1000);
    });

    it('scores partial correctness proportionally', () => {
      const result = makeRunnerResult({
        harnessResults: [
          { testId: 't1', passed: true },
          { testId: 't2', passed: false },
        ],
        executionMetadata: {
          durationMs: 0,
          memoryUsedBytes: 0,
          exitCode: 0,
          timedOut: false,
        },
      });

      const scored = scoreRunnerResult(result);
      expect(scored.scoreResult.correctness).toBe(0.5);
      expect(scored.scoreResult.baseScore).toBe(500);
      expect(scored.scoreResult.totalScore).toBe(500);
    });

    it('latency affects score proportionally', () => {
      const result = makeRunnerResult({
        harnessResults: [{ testId: 't1', passed: true }],
        executionMetadata: {
          durationMs: SCORING_CONFIG.LATENCY_BASELINE_MS,
          memoryUsedBytes: 0,
          exitCode: 0,
          timedOut: false,
        },
      });

      const scored = scoreRunnerResult(result);
      expect(scored.scoreResult.correctness).toBe(1);
      expect(scored.scoreResult.latencyFactor).toBe(0);
      // Only correctness weight (0.7) + resource weight (0.1*1)
      expect(scored.scoreResult.totalScore).toBe(800);
    });

    it('memory usage affects score proportionally', () => {
      const result = makeRunnerResult({
        harnessResults: [{ testId: 't1', passed: true }],
        executionMetadata: {
          durationMs: 0,
          memoryUsedBytes: SCORING_CONFIG.MEMORY_BASELINE_BYTES,
          exitCode: 0,
          timedOut: false,
        },
      });

      const scored = scoreRunnerResult(result);
      expect(scored.scoreResult.correctness).toBe(1);
      expect(scored.scoreResult.resourceFactor).toBe(0);
      // Correctness (0.7) + latency (0.2*1) = 900
      expect(scored.scoreResult.totalScore).toBe(900);
    });

    it('both latency and memory at maximum reduce to 70% of base', () => {
      const result = makeRunnerResult({
        harnessResults: [{ testId: 't1', passed: true }],
        executionMetadata: {
          durationMs: SCORING_CONFIG.LATENCY_BASELINE_MS,
          memoryUsedBytes: SCORING_CONFIG.MEMORY_BASELINE_BYTES,
          exitCode: 0,
          timedOut: false,
        },
      });

      const scored = scoreRunnerResult(result);
      // Only correctness weight: 1000 * 0.7 = 700
      expect(scored.scoreResult.totalScore).toBe(700);
    });
  });

  describe('LLM bonus integration', () => {
    it('applies LLM bonus on top of base score', () => {
      const result = makeRunnerResult({
        harnessResults: [{ testId: 't1', passed: true }],
        executionMetadata: {
          durationMs: 0,
          memoryUsedBytes: 0,
          exitCode: 0,
          timedOut: false,
        },
      });

      const scored = scoreRunnerResult(result, { rawScore: 1.0 });
      expect(scored.scoreResult.llmBonus).toBe(100);
      expect(scored.scoreResult.totalScore).toBe(1100);
    });

    it('LLM bonus capped at 10% of base score', () => {
      const result = makeRunnerResult({
        harnessResults: [{ testId: 't1', passed: true }],
        executionMetadata: {
          durationMs: 0,
          memoryUsedBytes: 0,
          exitCode: 0,
          timedOut: false,
        },
      });

      const scored = scoreRunnerResult(result, { rawScore: 5.0 });
      // Should still cap at 100 (10% of 1000 base)
      expect(scored.scoreResult.llmBonus).toBe(100);
    });

    it('LLM bonus is zero when all tests fail', () => {
      const result = makeRunnerResult({
        harnessResults: [
          { testId: 't1', passed: false },
          { testId: 't2', passed: false },
        ],
      });

      const scored = scoreRunnerResult(result, { rawScore: 1.0 });
      expect(scored.scoreResult.llmBonus).toBe(0);
      expect(scored.scoreResult.totalScore).toBe(0);
    });
  });

  describe('determinism', () => {
    it('same RunnerResult always produces the same score', () => {
      const result = makeRunnerResult({
        harnessResults: [
          { testId: 't1', passed: true },
          { testId: 't2', passed: false },
          { testId: 't3', passed: true },
        ],
        executionMetadata: {
          durationMs: 5000,
          memoryUsedBytes: 10_000_000,
          exitCode: 0,
          timedOut: false,
        },
      });

      const scored1 = scoreRunnerResult(result);
      const scored2 = scoreRunnerResult(result);

      expect(scored1.scoreResult.totalScore).toBe(scored2.scoreResult.totalScore);
      expect(scored1.scoreResult.correctness).toBe(scored2.scoreResult.correctness);
      expect(scored1.scoreResult.baseScore).toBe(scored2.scoreResult.baseScore);
      expect(scored1.scoreResult.latencyFactor).toBe(scored2.scoreResult.latencyFactor);
      expect(scored1.scoreResult.resourceFactor).toBe(scored2.scoreResult.resourceFactor);
    });
  });

  describe('scoreBreakdown in output', () => {
    it('scoreBreakdown matches scoreResult', () => {
      const result = makeRunnerResult({
        harnessResults: [
          { testId: 't1', passed: true },
          { testId: 't2', passed: true },
          { testId: 't3', passed: false },
        ],
        executionMetadata: {
          durationMs: 10_000,
          memoryUsedBytes: 100_000_000,
          exitCode: 0,
          timedOut: false,
        },
      });

      const scored = scoreRunnerResult(result);

      expect(scored.scoreBreakdown.correctness).toBe(scored.scoreResult.correctness);
      expect(scored.scoreBreakdown.baseScore).toBe(scored.scoreResult.baseScore);
      expect(scored.scoreBreakdown.totalScore).toBe(scored.scoreResult.totalScore);
      expect(scored.scoreBreakdown.latencyFactor).toBe(scored.scoreResult.latencyFactor);
      expect(scored.scoreBreakdown.resourceFactor).toBe(scored.scoreResult.resourceFactor);
      expect(scored.scoreBreakdown.llmBonus).toBe(scored.scoreResult.llmBonus);
    });
  });

  describe('edge cases', () => {
    it('handles single test case that passes', () => {
      const result = makeRunnerResult({
        harnessResults: [{ testId: 't1', passed: true }],
      });

      const scored = scoreRunnerResult(result);
      expect(scored.scoreResult.correctness).toBe(1);
      expect(scored.scoreResult.totalScore).toBeGreaterThan(0);
    });

    it('handles single test case that fails', () => {
      const result = makeRunnerResult({
        harnessResults: [{ testId: 't1', passed: false }],
      });

      const scored = scoreRunnerResult(result);
      expect(scored.scoreResult.correctness).toBe(0);
      expect(scored.scoreResult.totalScore).toBe(0);
    });

    it('handles many test cases', () => {
      const harnessResults = Array.from({ length: 100 }, (_, i) => ({
        testId: `t${i}`,
        passed: i < 75, // 75% pass rate
      }));

      const result = makeRunnerResult({ harnessResults });
      const scored = scoreRunnerResult(result);

      expect(scored.scoreResult.correctness).toBe(0.75);
      expect(scored.scoreResult.baseScore).toBe(750);
    });

    it('handles zero duration and zero memory', () => {
      const result = makeRunnerResult({
        harnessResults: [{ testId: 't1', passed: true }],
        executionMetadata: {
          durationMs: 0,
          memoryUsedBytes: 0,
          exitCode: 0,
          timedOut: false,
        },
      });

      const scored = scoreRunnerResult(result);
      expect(scored.scoreResult.latencyFactor).toBe(1);
      expect(scored.scoreResult.resourceFactor).toBe(1);
    });
  });
});
