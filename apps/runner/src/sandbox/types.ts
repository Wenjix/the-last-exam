// === Sandbox Configuration ===

export interface SandboxConfig {
  /** Maximum execution time in milliseconds (hard cap). */
  timeoutMs: number;
  /** Maximum heap memory in bytes for the sandboxed process. */
  memoryLimitBytes: number;
  /** Maximum disk usage in bytes for temporary files. */
  diskLimitBytes: number;
  /** Whether the sandboxed process is allowed network access. */
  networkEnabled: boolean;
}

/** Sensible defaults matching the issue specification. */
export const DEFAULT_SANDBOX_CONFIG: Readonly<SandboxConfig> = {
  timeoutMs: 60_000, // 60 seconds hard cap
  memoryLimitBytes: 512 * 1024 * 1024, // 512 MB
  diskLimitBytes: 100 * 1024 * 1024, // 100 MB
  networkEnabled: false,
};

// === Sandbox Execution Result ===

export interface SandboxResult {
  /** Captured standard output from the sandboxed process. */
  stdout: string;
  /** Captured standard error from the sandboxed process. */
  stderr: string;
  /** Process exit code (non-zero indicates failure). */
  exitCode: number;
  /** Wall-clock execution duration in milliseconds. */
  durationMs: number;
  /** Peak memory usage in bytes, if available from the provider. */
  memoryUsedBytes?: number;
  /** Whether the process was terminated due to exceeding the time limit. */
  timedOut: boolean;
  /** Whether the process was forcefully killed (timeout, OOM, etc.). */
  killed: boolean;
}

// === Sandbox Provider Interface ===

/**
 * Abstract provider for sandboxed code execution.
 *
 * Implementations must:
 * - Execute arbitrary user code in an isolated environment
 * - Enforce resource limits (time, memory, disk, network)
 * - Capture stdout, stderr, and exit code
 * - Never throw -- all errors are represented as a SandboxResult
 *   with a non-zero exit code and descriptive stderr
 *
 * Current implementations:
 * - LocalSandboxProvider -- subprocess via child_process.spawn (dev default)
 * - E2BSandboxProvider  -- E2B cloud sandbox (stub, requires API key)
 */
export interface SandboxProvider {
  /**
   * Execute code in the sandbox.
   *
   * @param code     - Source code to execute.
   * @param language - Language identifier (e.g. 'javascript', 'typescript').
   * @param config   - Optional overrides merged with DEFAULT_SANDBOX_CONFIG.
   * @returns        - Structured result; never rejects.
   */
  execute(code: string, language: string, config?: Partial<SandboxConfig>): Promise<SandboxResult>;
}
