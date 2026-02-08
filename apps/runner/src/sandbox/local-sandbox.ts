import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { SandboxConfig, SandboxProvider, SandboxResult } from './types.js';
import { DEFAULT_SANDBOX_CONFIG } from './types.js';

// === Supported Languages ===

/** Languages the local provider can execute. */
const SUPPORTED_LANGUAGES = new Set(['javascript', 'typescript']);

/**
 * Map language identifiers to file extensions.
 * TypeScript is transpiled via tsx/ts-node or falls back to node with
 * --experimental-strip-types when available; for simplicity the local
 * provider writes a .mjs file for JS and runs TS through `npx tsx`.
 */
function fileExtension(language: string): string {
  switch (language) {
    case 'typescript':
      return '.ts';
    case 'javascript':
    default:
      return '.mjs';
  }
}

// === Local Sandbox Provider ===

/**
 * Executes user code in a local subprocess via `child_process.spawn`.
 *
 * Resource-limit enforcement in local mode:
 * - **Time**   -- enforced via `setTimeout` + SIGKILL.
 * - **Memory** -- enforced via `--max-old-space-size` (V8 heap limit).
 * - **Disk**   -- NOT enforced (documented limitation of local mode).
 * - **Network** -- NOT restricted (documented limitation of local mode).
 *
 * This provider never throws. All errors are captured and returned as a
 * structured `SandboxResult` with a non-zero exit code and descriptive stderr.
 */
export class LocalSandboxProvider implements SandboxProvider {
  async execute(
    code: string,
    language: string,
    config?: Partial<SandboxConfig>,
  ): Promise<SandboxResult> {
    const cfg: SandboxConfig = { ...DEFAULT_SANDBOX_CONFIG, ...config };

    // Unsupported language -- return immediately with an error result.
    if (!SUPPORTED_LANGUAGES.has(language)) {
      return {
        stdout: '',
        stderr: `Unsupported language: ${language}. Supported: ${[...SUPPORTED_LANGUAGES].join(', ')}`,
        exitCode: 1,
        durationMs: 0,
        timedOut: false,
        killed: false,
      };
    }

    // Create a temporary directory for the code file.
    let tempDir: string | undefined;

    try {
      tempDir = await mkdtemp(join(tmpdir(), 'tle-sandbox-'));
      const ext = fileExtension(language);
      const filePath = join(tempDir, `submission${ext}`);
      await writeFile(filePath, code, 'utf-8');

      return await this.spawnAndCollect(filePath, language, cfg);
    } catch (err: unknown) {
      // File-system or other unexpected errors -- still return a result.
      const message = err instanceof Error ? err.message : String(err);
      return {
        stdout: '',
        stderr: `Sandbox setup error: ${message}`,
        exitCode: 1,
        durationMs: 0,
        timedOut: false,
        killed: false,
      };
    } finally {
      // Clean up temp directory.
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {
          /* best-effort cleanup */
        });
      }
    }
  }

  // --- Private helpers ---

  private spawnAndCollect(
    filePath: string,
    language: string,
    cfg: SandboxConfig,
  ): Promise<SandboxResult> {
    return new Promise((resolve) => {
      const maxOldSpaceMB = Math.floor(cfg.memoryLimitBytes / (1024 * 1024));
      const { command, args } = this.buildCommand(filePath, language, maxOldSpaceMB);

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let timedOut = false;
      let killed = false;

      const startMs = Date.now();

      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        // Prevent the child from inheriting the parent's signal handlers.
        detached: false,
      });

      // Timeout enforcement.
      const timer = setTimeout(() => {
        timedOut = true;
        killed = true;
        // SIGKILL is not catchable -- guarantees termination.
        child.kill('SIGKILL');
      }, cfg.timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      // Handle spawn errors (e.g. command not found).
      child.on('error', (err: Error) => {
        clearTimeout(timer);
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
          stderr: `Spawn error: ${err.message}`,
          exitCode: 1,
          durationMs: Date.now() - startMs,
          timedOut: false,
          killed: false,
        });
      });

      child.on('close', (exitCode: number | null, signal: string | null) => {
        clearTimeout(timer);

        // If the process was killed by a signal other than our timeout SIGKILL,
        // still mark it as killed.
        if (signal && !timedOut) {
          killed = true;
        }

        resolve({
          stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
          stderr: Buffer.concat(stderrChunks).toString('utf-8'),
          exitCode: exitCode ?? (signal ? 137 : 1),
          durationMs: Date.now() - startMs,
          timedOut,
          killed,
        });
      });
    });
  }

  /**
   * Build the command + args array for the given language.
   *
   * JavaScript: `node --max-old-space-size=<MB> <file>`
   * TypeScript: `npx tsx --max-old-space-size=<MB> <file>`
   */
  private buildCommand(
    filePath: string,
    language: string,
    maxOldSpaceMB: number,
  ): { command: string; args: string[] } {
    const nodeFlags = [`--max-old-space-size=${maxOldSpaceMB}`];

    if (language === 'typescript') {
      return {
        command: 'npx',
        args: ['tsx', ...nodeFlags, filePath],
      };
    }

    // Default: javascript
    return {
      command: 'node',
      args: [...nodeFlags, filePath],
    };
  }
}
