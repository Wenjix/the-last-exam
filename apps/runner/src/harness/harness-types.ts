// === Harness Configuration ===

/** A single test case with input and expected output. */
export interface HarnessTestCase {
  /** Unique identifier for this test case. */
  testId: string;
  /** Input to feed the submitted code (via stdin). */
  input: string;
  /** Expected output (compared against trimmed stdout). */
  expectedOutput: string;
}

/** Configuration for running a challenge harness. */
export interface HarnessConfig {
  /** ID of the challenge being tested. */
  challengeId: string;
  /** Test cases to run against the submitted code. */
  testCases: HarnessTestCase[];
  /** Per-test execution time limit in milliseconds. */
  timeLimitMs: number;
  /** Per-test memory limit in bytes. */
  memoryLimitBytes: number;
}

// === Harness Results ===

/** Result of a single test case execution. */
export interface HarnessTestResult {
  /** ID of the test case (matches HarnessTestCase.testId). */
  testId: string;
  /** Whether the actual output matched the expected output. */
  passed: boolean;
  /** Actual output produced by the submitted code (trimmed). */
  actualOutput: string;
  /** Expected output for comparison. */
  expectedOutput: string;
  /** Wall-clock execution time for this test case in milliseconds. */
  executionTimeMs: number;
  /** Error message if the test case failed due to an execution error. */
  errorMessage?: string;
}

/** Aggregate result of running all test cases in a harness. */
export interface HarnessResult {
  /** Individual results for each test case. */
  results: HarnessTestResult[];
  /** Overall score from 0 to 100 (passed / total * 100). */
  overallScore: number;
  /** Total wall-clock time across all test cases in milliseconds. */
  totalTimeMs: number;
  /** Number of test cases that passed. */
  passedCount: number;
  /** Number of test cases that failed. */
  failedCount: number;
}
