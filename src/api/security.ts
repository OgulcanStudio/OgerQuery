import { filterFieldRoot, isSafePropertyKey } from '../utils/path.js';

export const DEFAULT_API_MAX_LIMIT = 1000;
export const DEFAULT_API_MAX_DEPTH = 5;

export type ApiSecurityOptions = {
  allowedFields?: readonly string[];
  maxLimit?: number;
  maxDepth?: number;
};

export function assertAllowedField(field: string, allowed?: readonly string[]): void {
  if (!isSafePropertyKey(filterFieldRoot(field))) {
    throw new Error('Invalid field name');
  }
  if (allowed && !allowed.includes(field)) {
    throw new Error('Field is not allowed');
  }
}

export function clampLimit(limit: number, max = DEFAULT_API_MAX_LIMIT): number {
  if (!Number.isFinite(limit) || limit < 1) return 1;
  return Math.min(Math.floor(limit), max);
}

/** Finite page/pageSize from query strings; invalid values become undefined. */
export function parsePositiveInt(raw: string): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

export function assertMaxDepth(depth: number, max = DEFAULT_API_MAX_DEPTH): void {
  if (depth > max) {
    throw new Error('Filter depth exceeds maximum');
  }
}

export function sanitizeFilterObject(
  input: Record<string, unknown>,
  depth = 0,
  maxDepth = DEFAULT_API_MAX_DEPTH,
): Record<string, unknown> {
  assertMaxDepth(depth, maxDepth);
  const out: Record<string, unknown> = Object.create(null);
  for (const [key, value] of Object.entries(input)) {
    if (!isSafePropertyKey(key)) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = sanitizeFilterObject(value as Record<string, unknown>, depth + 1, maxDepth);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function safeApiError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Request failed';
}
