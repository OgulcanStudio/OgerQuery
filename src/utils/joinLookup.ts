import type { EqualityComparer, Selector } from '../core/types.js';

export type JoinLookup<TInner, TKey> = Map<unknown, TInner[]>;

export function buildJoinLookup<TInner, TKey>(
  inner: Iterable<TInner>,
  innerKeySelector: Selector<TInner, TKey>,
  comparer?: EqualityComparer<TKey>,
): { lookup: JoinLookup<TInner, TKey>; eq: EqualityComparer<TKey>; isDefault: boolean } {
  const isDefault = comparer === undefined;
  const eq = comparer ?? (Object.is as EqualityComparer<TKey>);
  const lookup: JoinLookup<TInner, TKey> = new Map();
  let innerIndex = 0;
  for (const item of inner) {
    const key = innerKeySelector(item, innerIndex);
    const list = lookup.get(key);
    if (list) list.push(item);
    else lookup.set(key, [item]);
    innerIndex++;
  }
  return { lookup, eq, isDefault };
}

export function findJoinMatches<TInner, TKey>(
  lookup: JoinLookup<TInner, TKey>,
  key: TKey,
  eq: EqualityComparer<TKey>,
  isDefault = false,
): TInner[] {
  if (isDefault) {
    return lookup.get(key) ?? [];
  }
  const matches: TInner[] = [];
  for (const [storedKey, inners] of lookup) {
    if (eq(storedKey as TKey, key)) matches.push(...inners);
  }
  return matches;
}
