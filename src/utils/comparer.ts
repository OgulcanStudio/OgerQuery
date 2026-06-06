import type { Comparer, EqualityComparer } from '../core/types.js';
import { defaultComparer } from './defaultComparer.js';

export function compareWith<T>(
  a: T,
  b: T,
  comparer: Comparer<T> = defaultComparer as Comparer<T>,
): number {
  return comparer(a, b);
}

export function equalsWith<T>(
  a: T,
  b: T,
  comparer: EqualityComparer<T> = Object.is as EqualityComparer<T>,
): boolean {
  return comparer(a, b);
}
