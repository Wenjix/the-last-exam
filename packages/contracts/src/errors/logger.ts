import type { TleErrorContext } from './tle-error.js';
import type { ErrorCode } from './error-codes.js';

/**
 * Log levels for structured logging.
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal',
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

/**
 * Structured log entry format.
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  code?: ErrorCode;
  context?: TleErrorContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Minimal structured logger for The Last Exam.
 * Outputs JSON-formatted log entries to stdout/stderr.
 * Designed to be replaced with a more sophisticated logger later if needed.
 */
export function createLogger(defaultContext?: TleErrorContext) {
  function log(level: LogLevel, message: string, extra?: { code?: ErrorCode; context?: TleErrorContext; error?: Error }) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    if (extra?.code) entry.code = extra.code;

    const mergedContext = { ...defaultContext, ...extra?.context };
    if (Object.keys(mergedContext).length > 0) entry.context = mergedContext;

    if (extra?.error) {
      entry.error = {
        name: extra.error.name,
        message: extra.error.message,
        stack: extra.error.stack,
      };
    }

    const output = JSON.stringify(entry);

    if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }

  return {
    debug: (message: string, extra?: { code?: ErrorCode; context?: TleErrorContext; error?: Error }) =>
      log(LogLevel.DEBUG, message, extra),
    info: (message: string, extra?: { code?: ErrorCode; context?: TleErrorContext; error?: Error }) =>
      log(LogLevel.INFO, message, extra),
    warn: (message: string, extra?: { code?: ErrorCode; context?: TleErrorContext; error?: Error }) =>
      log(LogLevel.WARN, message, extra),
    error: (message: string, extra?: { code?: ErrorCode; context?: TleErrorContext; error?: Error }) =>
      log(LogLevel.ERROR, message, extra),
    fatal: (message: string, extra?: { code?: ErrorCode; context?: TleErrorContext; error?: Error }) =>
      log(LogLevel.FATAL, message, extra),
    child: (childContext: TleErrorContext) =>
      createLogger({ ...defaultContext, ...childContext }),
  };
}

export type Logger = ReturnType<typeof createLogger>;
