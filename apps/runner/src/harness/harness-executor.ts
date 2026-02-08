import type { SandboxProvider } from '../sandbox/types.js';
import type { HarnessConfig, HarnessResult, HarnessTestResult } from './harness-types.js';

/**
 * Wrap submitted code so that it reads input from a hard-coded string
 * instead of requiring external stdin piping.
 *
 * The wrapper replaces the first call to any readline-based input with the
 * provided test input by overriding process.stdin to emit the data.
 */
function wrapCodeWithInput(code: string, input: string): string {
  // Provide the input as a pre-populated stdin buffer.  The submitted code
  // can read it via process.stdin, readline, or similar mechanisms.
  const escapedInput = JSON.stringify(input);
  return [
    `// --- harness: inject test input via stdin ---`,
    `const { Readable } = require('stream');`,
    `const __harnessInput = new Readable({ read() {} });`,
    `__harnessInput.push(${escapedInput});`,
    `__harnessInput.push(null);`,
    `Object.defineProperty(process, 'stdin', {`,
    `  value: __harnessInput,`,
    `  writable: true,`,
    `  configurable: true,`,
    `});`,
    `// --- end harness preamble ---`,
    ``,
    code,
  ].join('\n');
}

/**
 * Compare actual output to expected output.
 * Both values are trimmed to ignore trailing whitespace / newlines.
 */
function outputMatches(actual: string, expected: string): boolean {
  return actual.trim() === expected.trim();
}

/**
 * Execute a full test harness: run the submitted code against every test
 * case in the config and produce an aggregate result.
 *
 * Deterministic: same code + same test cases = same result (assuming the
 * sandbox itself is deterministic, which it is for non-random code).
 *
 * @param submittedCode - The source code to test.
 * @param config        - Harness configuration with test cases and limits.
 * @param sandbox       - SandboxProvider used for isolated execution.
 * @param language      - Language identifier (default: 'javascript').
 * @returns             - Aggregate harness result.
 */
export async function executeHarness(
  submittedCode: string,
  config: HarnessConfig,
  sandbox: SandboxProvider,
  language: string = 'javascript',
): Promise<HarnessResult> {
  const results: HarnessTestResult[] = [];
  let totalTimeMs = 0;
  let passedCount = 0;

  for (const testCase of config.testCases) {
    const wrappedCode = wrapCodeWithInput(submittedCode, testCase.input);

    let testResult: HarnessTestResult;

    try {
      const sandboxResult = await sandbox.execute(wrappedCode, language, {
        timeoutMs: config.timeLimitMs,
        memoryLimitBytes: config.memoryLimitBytes,
      });

      const actualOutput = sandboxResult.stdout.trim();
      const executionTimeMs = sandboxResult.durationMs;
      totalTimeMs += executionTimeMs;

      if (sandboxResult.timedOut) {
        testResult = {
          testId: testCase.testId,
          passed: false,
          actualOutput,
          expectedOutput: testCase.expectedOutput,
          executionTimeMs,
          errorMessage: 'Execution timed out',
        };
      } else if (sandboxResult.killed) {
        testResult = {
          testId: testCase.testId,
          passed: false,
          actualOutput,
          expectedOutput: testCase.expectedOutput,
          executionTimeMs,
          errorMessage: `Process killed (exit code: ${sandboxResult.exitCode})`,
        };
      } else if (sandboxResult.exitCode !== 0) {
        testResult = {
          testId: testCase.testId,
          passed: false,
          actualOutput,
          expectedOutput: testCase.expectedOutput,
          executionTimeMs,
          errorMessage: sandboxResult.stderr || `Non-zero exit code: ${sandboxResult.exitCode}`,
        };
      } else {
        const passed = outputMatches(actualOutput, testCase.expectedOutput);
        testResult = {
          testId: testCase.testId,
          passed,
          actualOutput,
          expectedOutput: testCase.expectedOutput,
          executionTimeMs,
        };
      }
    } catch (err: unknown) {
      // Sandbox threw unexpectedly -- mark test as failed gracefully.
      const message = err instanceof Error ? err.message : String(err);
      testResult = {
        testId: testCase.testId,
        passed: false,
        actualOutput: '',
        expectedOutput: testCase.expectedOutput,
        executionTimeMs: 0,
        errorMessage: `Sandbox error: ${message}`,
      };
    }

    if (testResult.passed) {
      passedCount++;
    }

    results.push(testResult);
  }

  const totalCases = config.testCases.length;
  const overallScore = totalCases > 0 ? (passedCount / totalCases) * 100 : 0;

  return {
    results,
    overallScore,
    totalTimeMs,
    passedCount,
    failedCount: totalCases - passedCount,
  };
}
