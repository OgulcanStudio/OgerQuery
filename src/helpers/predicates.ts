import type { Predicate } from '../core/types.js';
import { getByPath } from '../utils/path.js';

export type PathOrKey<T> = keyof T & string | string;

function resolveValue<T>(item: T, path: PathOrKey<T>): unknown {
  if (typeof path === 'string' && path.includes('.')) return getByPath(item, path);
  return (item as Record<string, unknown>)[path as string];
}

export function whereEq<T>(path: PathOrKey<T>, value: unknown): Predicate<T> {
  return (item) => resolveValue(item, path) === value;
}

export function whereNotEq<T>(path: PathOrKey<T>, value: unknown): Predicate<T> {
  return (item) => resolveValue(item, path) !== value;
}

export function whereGt<T>(path: PathOrKey<T>, value: number | string | Date): Predicate<T> {
  return (item) => {
    const v = resolveValue(item, path);
    return v != null && (v as number | string | Date) > value;
  };
}

export function whereGte<T>(path: PathOrKey<T>, value: number | string | Date): Predicate<T> {
  return (item) => {
    const v = resolveValue(item, path);
    return v != null && (v as number | string | Date) >= value;
  };
}

export function whereLt<T>(path: PathOrKey<T>, value: number | string | Date): Predicate<T> {
  return (item) => {
    const v = resolveValue(item, path);
    return v != null && (v as number | string | Date) < value;
  };
}

export function whereLte<T>(path: PathOrKey<T>, value: number | string | Date): Predicate<T> {
  return (item) => {
    const v = resolveValue(item, path);
    return v != null && (v as number | string | Date) <= value;
  };
}

export function whereIn<T>(path: PathOrKey<T>, values: readonly unknown[]): Predicate<T> {
  const set = new Set(values);
  return (item) => set.has(resolveValue(item, path));
}

export function whereNotIn<T>(path: PathOrKey<T>, values: readonly unknown[]): Predicate<T> {
  const set = new Set(values);
  return (item) => !set.has(resolveValue(item, path));
}

export function whereBetween<T>(
  path: PathOrKey<T>,
  min: number | string | Date,
  max: number | string | Date,
): Predicate<T> {
  return (item) => {
    const v = resolveValue(item, path);
    return v != null && (v as number | string | Date) >= min && (v as number | string | Date) <= max;
  };
}

export function whereContains<T>(path: PathOrKey<T>, substring: string, insensitive = false): Predicate<T> {
  return (item) => {
    const v = resolveValue(item, path);
    if (typeof v !== 'string') return false;
    return insensitive
      ? v.toLowerCase().includes(substring.toLowerCase())
      : v.includes(substring);
  };
}

export function whereStartsWith<T>(path: PathOrKey<T>, prefix: string, insensitive = false): Predicate<T> {
  return (item) => {
    const v = resolveValue(item, path);
    if (typeof v !== 'string') return false;
    return insensitive
      ? v.toLowerCase().startsWith(prefix.toLowerCase())
      : v.startsWith(prefix);
  };
}

export function whereEndsWith<T>(path: PathOrKey<T>, suffix: string, insensitive = false): Predicate<T> {
  return (item) => {
    const v = resolveValue(item, path);
    if (typeof v !== 'string') return false;
    return insensitive
      ? v.toLowerCase().endsWith(suffix.toLowerCase())
      : v.endsWith(suffix);
  };
}

export function whereNull<T>(path: PathOrKey<T>): Predicate<T> {
  return (item) => resolveValue(item, path) == null;
}

export function whereNotNull<T>(path: PathOrKey<T>): Predicate<T> {
  return (item) => resolveValue(item, path) != null;
}

export function whereTruthy<T>(path: PathOrKey<T>): Predicate<T> {
  return (item) => Boolean(resolveValue(item, path));
}

export function whereFalsy<T>(path: PathOrKey<T>): Predicate<T> {
  return (item) => !resolveValue(item, path);
}

export function pluck<T, K extends PathOrKey<T>>(path: K): (item: T) => unknown {
  return (item) => resolveValue(item, path);
}

export function selectKeys<T extends object>(keys: (keyof T)[]): (item: T) => Partial<T> {
  return (item) => {
    const out: Partial<T> = {};
    for (const key of keys) {
      out[key] = item[key];
    }
    return out;
  };
}

export function omitKeys<T extends object>(keys: (keyof T)[]): (item: T) => Partial<T> {
  const omit = new Set(keys);
  return (item) => {
    const out: Partial<T> = {};
    for (const key of Object.keys(item) as (keyof T)[]) {
      if (!omit.has(key)) out[key] = item[key];
    }
    return out;
  };
}
