import type { NullSortStrategy } from '../core/pipelineOps.js';

const PATH_RE = /^[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*$/;

export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  if (!PATH_RE.test(path)) {
    throw new Error(`Invalid property path: ${path}`);
  }
  let current: unknown = obj;
  for (const segment of path.split('.')) {
    if (current == null || (typeof current !== 'object' && typeof current !== 'function')) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function isSafePropertyKey(key: string): boolean {
  return key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
}

/** First segment of a dot-path filter field (e.g. `profile.age` → `profile`). */
export function filterFieldRoot(field: string): string {
  const dot = field.indexOf('.');
  return dot < 0 ? field : field.slice(0, dot);
}

/** Compare two order keys when either may be null/undefined; returns null if neither is. */
export function compareNullSortKeys(
  ka: unknown,
  kb: unknown,
  nulls: NullSortStrategy,
): number | null {
  const aNull = ka == null;
  const bNull = kb == null;
  if (!aNull && !bNull) return null;
  if (aNull && bNull) return 0;
  if (aNull) return nulls === 'first' ? -1 : 1;
  return nulls === 'first' ? 1 : -1;
}
