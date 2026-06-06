import type {
  Comparer,
  EqualityComparer,
  OrderKey,
  Predicate,
  Selector,
} from './types.js';
import { FeatureRegistry } from './FeaturePlugin.js';


export type NullSortStrategy = 'first' | 'last';

export type OrderKeyEntry<T> = {
  key: OrderKey<T, unknown>;
  descending: boolean;
  comparer?: Comparer<unknown>;
  nulls?: NullSortStrategy;
  /** When true, string keys use `localeCompare` with optional `locale`. */
  localeCompare?: boolean | string;
};

export type PipelineOp<T> =
  | { kind: 'where'; predicate: Predicate<T> }
  | { kind: 'select'; selector: Selector<T, unknown> }
  | { kind: 'selectMany'; selector: Selector<T, Iterable<unknown>> }
  | { kind: 'ofType'; guard?: (item: unknown) => boolean }
  | { kind: 'cast' }
  | { kind: 'take'; count: number }
  | { kind: 'skip'; count: number }
  | { kind: 'takeWhile'; predicate: Predicate<T> }
  | { kind: 'skipWhile'; predicate: Predicate<T> }
  | { kind: 'orderBy'; keys: OrderKeyEntry<T>[] }
  | { kind: 'reverse' }
  | { kind: 'distinct'; comparer?: EqualityComparer<T> }
  | { kind: 'distinctBy'; keySelector: Selector<T, unknown>; comparer?: EqualityComparer<unknown> }
  | { kind: 'groupBy'; keySelector: Selector<T, unknown>; elementSelector?: Selector<T, unknown> }
  | {
      kind: 'join';
      inner: Iterable<unknown>;
      outerKeySelector: Selector<T, unknown>;
      innerKeySelector: Selector<unknown, unknown>;
      resultSelector: (outer: T, inner: unknown) => unknown;
      comparer?: EqualityComparer<unknown>;
    }
  | {
      kind: 'groupJoin';
      inner: Iterable<unknown>;
      outerKeySelector: Selector<T, unknown>;
      innerKeySelector: Selector<unknown, unknown>;
      resultSelector: (outer: T, inner: Iterable<unknown>) => unknown;
      comparer?: EqualityComparer<unknown>;
    }
  | {
      kind: 'leftJoin';
      inner: Iterable<unknown>;
      outerKeySelector: Selector<T, unknown>;
      innerKeySelector: Selector<unknown, unknown>;
      resultSelector: (outer: T, inner: unknown | null) => unknown;
      comparer?: EqualityComparer<unknown>;
    }
  | {
      kind: 'rightJoin';
      inner: Iterable<unknown>;
      outerKeySelector: Selector<T, unknown>;
      innerKeySelector: Selector<unknown, unknown>;
      resultSelector: (outer: T | null, inner: unknown) => unknown;
      comparer?: EqualityComparer<unknown>;
    }
  | {
      kind: 'fullJoin';
      inner: Iterable<unknown>;
      outerKeySelector: Selector<T, unknown>;
      innerKeySelector: Selector<unknown, unknown>;
      resultSelector: (outer: T | null, inner: unknown | null) => unknown;
      comparer?: EqualityComparer<unknown>;
    }
  | {
      kind: 'zip';
      second: Iterable<unknown>;
      resultSelector: (first: T, second: unknown) => unknown;
    }
  | { kind: 'concat'; second: Iterable<unknown> | AsyncIterable<unknown> }
  | {
      kind: 'union';
      second: Iterable<unknown> | AsyncIterable<unknown>;
      comparer?: EqualityComparer<T>;
    }
  | {
      kind: 'intersect';
      second: Iterable<unknown> | AsyncIterable<unknown>;
      comparer?: EqualityComparer<T>;
    }
  | {
      kind: 'except';
      second: Iterable<unknown> | AsyncIterable<unknown>;
      comparer?: EqualityComparer<T>;
    }
  | { kind: 'chunk'; size: number }
  | {
      kind: 'scan';
      seed: unknown;
      func: (acc: unknown, item: T, index: number) => unknown;
    }
  | { kind: 'withIndex' }
  | { kind: 'buffer'; size: number; step: number }
  | { kind: 'tryWhere'; predicate: Predicate<T> }
  | { kind: 'pairwise' }
  | { kind: 'tap'; action: (item: T, index: number) => void }
  | { kind: 'flatten' }
  | { kind: 'adjacentDistinct'; comparer?: EqualityComparer<T> }
  | { kind: 'prepend'; items: Iterable<T> }
  | { kind: 'append'; items: Iterable<T> }
  | { kind: 'defaultIfEmpty'; defaultValue: T }
  | { kind: 'index' }
  | { kind: 'takeLast'; count: number }
  | { kind: 'skipLast'; count: number }
  | {
      kind: 'aggregateBy';
      keySelector: Selector<T, unknown>;
      seed: unknown;
      func: (acc: unknown, item: T) => unknown;
      comparer?: EqualityComparer<unknown>;
    }
  | {
      kind: 'unionBy';
      second: Iterable<unknown>;
      keySelector: Selector<T, unknown>;
      comparer?: EqualityComparer<unknown>;
    }
  | {
      kind: 'intersectBy';
      second: Iterable<unknown>;
      keySelector: Selector<T, unknown>;
      comparer?: EqualityComparer<unknown>;
    }
  | {
      kind: 'exceptBy';
      second: Iterable<unknown>;
      keySelector: Selector<T, unknown>;
      comparer?: EqualityComparer<unknown>;
    };

export function isMaterializingOpAt<T>(ops: PipelineOp<T>[], index: number): boolean {
  const op = ops[index];
  if (!op) return false;
  return isMaterializingOp(op);
}

export function isMaterializingOp<T>(op: PipelineOp<T>): boolean {
  const feature = FeatureRegistry.get(op.kind);
  return feature?.category === 'materializing';
}

export function isLazyFusableOp<T>(op: PipelineOp<T>): boolean {
  return (
    op.kind === 'where' ||
    op.kind === 'select' ||
    op.kind === 'take' ||
    op.kind === 'skip'
  );
}

export function canUseArrayFastPath<T>(ops: PipelineOp<T>[]): boolean {
  return ops.every((op) => isLazyFusableOp(op));
}
