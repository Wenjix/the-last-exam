import type { SandboxConfig, SandboxProvider, SandboxResult } from './types.js';
import { DEFAULT_SANDBOX_CONFIG } from './types.js';

// === E2B Sandbox Provider (Stub) ===

/**
 * Cloud sandbox provider backed by the E2B platform.
 *
 * **Current status: stub implementation.**
 *
 * This adapter checks for the `E2B_API_KEY` environment variable at
 * construction time. If the key is missing, {@link execute} rejects with
 * a descriptive error so callers know the provider is not configured.
 *
 * When E2B credentials are available, this class will be fleshed out to:
 * 1. Create an E2B sandbox instance with resource limits.
 * 2. Upload user code and execute it.
 * 3. Stream stdout/stderr and enforce time/memory/disk/network limits.
 * 4. Map E2B-specific failure modes to the structured `SandboxResult`.
 *
 * The E2B SDK (`e2b`) is NOT installed as a dependency -- add it when
 * implementing the real integration:
 *   `pnpm --filter @tle/runner add e2b`
 */
export class E2BSandboxProvider implements SandboxProvider {
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env['E2B_API_KEY'];
  }

  async execute(
    _code: string,
    _language: string,
    _config?: Partial<SandboxConfig>,
  ): Promise<SandboxResult> {
    if (!this.apiKey) {
      // Return an error result instead of throwing, consistent with the
      // SandboxProvider contract (never throw).
      return {
        stdout: '',
        stderr:
          'E2B API key not configured. Set the E2B_API_KEY environment variable ' +
          'or switch to the local sandbox provider (SANDBOX_PROVIDER=local).',
        exitCode: 1,
        durationMs: 0,
        timedOut: false,
        killed: false,
      };
    }

    // TODO: Implement E2B cloud sandbox execution.
    //
    // Rough sketch of the real implementation:
    //
    //   import { Sandbox } from 'e2b';
    //
    //   const sandbox = await Sandbox.create({
    //     apiKey: this.apiKey,
    //     template: 'base',  // or a custom template
    //   });
    //
    //   const cfg = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    //   const result = await sandbox.process.start({
    //     cmd: `node /tmp/submission.mjs`,
    //     timeout: cfg.timeoutMs,
    //   });
    //
    //   await sandbox.close();
    //
    //   return {
    //     stdout: result.stdout,
    //     stderr: result.stderr,
    //     exitCode: result.exitCode,
    //     durationMs: ...,
    //     timedOut: ...,
    //     killed: ...,
    //   };

    void DEFAULT_SANDBOX_CONFIG; // referenced to keep import alive for future use

    return {
      stdout: '',
      stderr:
        'E2B sandbox provider is not yet implemented. ' +
        'This is a placeholder -- see e2b-sandbox.ts for the integration sketch.',
      exitCode: 1,
      durationMs: 0,
      timedOut: false,
      killed: false,
    };
  }
}
