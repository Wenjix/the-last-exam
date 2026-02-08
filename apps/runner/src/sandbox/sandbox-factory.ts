import type { SandboxProvider } from './types.js';
import { LocalSandboxProvider } from './local-sandbox.js';
import { E2BSandboxProvider } from './e2b-sandbox.js';

// === Provider Type ===

export type SandboxProviderType = 'local' | 'e2b';

// === Factory ===

/**
 * Create a `SandboxProvider` instance based on the requested type.
 *
 * Resolution order:
 * 1. Explicit `type` argument.
 * 2. `SANDBOX_PROVIDER` environment variable (`'local'` | `'e2b'`).
 * 3. Falls back to `'local'`.
 *
 * @param type - Provider type override. When omitted the env var is consulted.
 * @returns      A ready-to-use `SandboxProvider`.
 * @throws       If an unknown provider type is requested.
 */
export function createSandboxProvider(type?: SandboxProviderType): SandboxProvider {
  const resolved: string = type ?? process.env['SANDBOX_PROVIDER'] ?? 'local';

  switch (resolved) {
    case 'local':
      return new LocalSandboxProvider();

    case 'e2b':
      return new E2BSandboxProvider();

    default:
      throw new Error(
        `Unknown sandbox provider type: "${resolved}". ` + `Valid values are "local" and "e2b".`,
      );
  }
}
