import { ErrorCategory, ErrorCode, getErrorCategory } from './error-codes.js';

/**
 * Game context attached to structured errors for debugging.
 */
export interface TleErrorContext {
  matchId?: string;
  round?: number;
  agentId?: string;
  phase?: string;
  [key: string]: unknown;
}

/**
 * Structured error class for The Last Exam.
 * All application errors should use this class for consistent
 * error handling, logging, and API responses.
 */
export class TleError extends Error {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly context: TleErrorContext;
  readonly timestamp: string;

  constructor(code: ErrorCode, message: string, context: TleErrorContext = {}) {
    super(message);
    this.name = 'TleError';
    this.code = code;
    this.category = getErrorCategory(code);
    this.context = context;
    this.timestamp = new Date().toISOString();
  }

  /** Serialize to structured log/API payload */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
    };
  }

  /** Create a structured API error response body */
  toApiResponse(): { error: Record<string, unknown> } {
    return {
      error: {
        code: this.code,
        category: this.category,
        message: this.message,
        ...(Object.keys(this.context).length > 0 && { context: this.context }),
      },
    };
  }
}
