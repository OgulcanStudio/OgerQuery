import type { Selector, Comparer } from '../../core/types.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { compareWith } from '../../utils/comparer.js';

export type OrderByOptions = {
  descending?: boolean;
  comparer?: Comparer<any>;
  nulls?: NullSortStrategy;
  localeCompare?: boolean | string;
};

export function toEntry(keySelector: Selector<any, any>, options: boolean | OrderByOptions): OrderKeyEntry<any> {
  const opts = typeof options === 'boolean' ? { descending: options } : options;
  return {
    key: keySelector,
    descending: opts.descending ?? false,
    ...(opts.comparer !== undefined ? { comparer: opts.comparer } : {}),
    ...(opts.nulls !== undefined ? { nulls: opts.nulls } : {}),
    ...(opts.localeCompare !== undefined ? { localeCompare: opts.localeCompare } : {}),
  };
}

export function compareOrderKeys(
  ka: unknown,
  kb: unknown,
  entry: {
    descending: boolean;
    comparer?: (a: unknown, b: unknown) => number;
    nulls?: NullSortStrategy;
    localeCompare?: boolean | string;
  },
): number {
  const nulls = entry.nulls ?? 'last';
  const nullCmp = compareNullSortKeys(ka, kb, nulls);
  if (nullCmp !== null) return nullCmp;
  let cmp: number;
  if (entry.localeCompare && typeof ka === 'string' && typeof kb === 'string') {
    const locale = typeof entry.localeCompare === 'string' ? entry.localeCompare : undefined;
    cmp = ka.localeCompare(kb, locale);
  } else {
    const cmpFn = entry.comparer ?? (defaultComparer as (x: unknown, y: unknown) => number);
    cmp = compareWith(ka, kb, cmpFn);
  }
  return entry.descending ? -cmp : cmp;
}

export function stableSortInPlace<T>(arr: T[], keys: OrderKeyEntry<T>[]): void {
  const indexed = arr.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => {
    for (const entry of keys) {
      const ka = entry.key(a.value, a.index);
      const kb = entry.key(b.value, b.index);
      const cmp = compareOrderKeys(ka, kb, entry);
      if (cmp !== 0) return cmp;
    }
    return a.index - b.index;
  });
  for (let i = 0; i < arr.length; i++) {
    arr[i] = indexed[i]!.value;
  }
}
