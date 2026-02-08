import type { Challenge } from '@tle/content';
import { DEFAULT_SANDBOX_CONFIG } from '../sandbox/types.js';
import type { HarnessConfig, HarnessTestCase } from './harness-types.js';

/**
 * Load a harness configuration for a specific challenge.
 *
 * Converts the challenge's test cases into the HarnessConfig format used by
 * the harness executor.  The challenge must exist in the provided list;
 * otherwise an error is thrown.
 *
 * @param challengeId - ID of the challenge to load.
 * @param challenges  - Array of validated Challenge objects from the content package.
 * @returns           - HarnessConfig ready for executeHarness().
 * @throws            - If the challenge ID is not found.
 */
export function loadChallengeHarness(challengeId: string, challenges: Challenge[]): HarnessConfig {
  const challenge = challenges.find((c) => c.id === challengeId);
  if (!challenge) {
    throw new Error(`Challenge not found: ${challengeId}`);
  }

  const testCases: HarnessTestCase[] = challenge.testCases.map((tc, index) => ({
    testId: `${challengeId}-tc-${index}`,
    input: tc.input,
    expectedOutput: tc.expectedOutput,
  }));

  return {
    challengeId: challenge.id,
    testCases,
    timeLimitMs: challenge.timeoutMs,
    memoryLimitBytes: DEFAULT_SANDBOX_CONFIG.memoryLimitBytes,
  };
}
