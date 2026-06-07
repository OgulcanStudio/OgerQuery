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
  } else if (entry.comparer) {
    cmp = entry.comparer(ka, kb);
  } else {
    if (ka === kb) {
      cmp = 0;
    } else {
      const ta = typeof ka;
      const tb = typeof kb;
      if (ta === tb && (ta === 'string' || ta === 'number' || ta === 'bigint')) {
        cmp = (ka as any) < (kb as any) ? -1 : 1;
      } else {
        cmp = defaultComparer(ka, kb);
      }
    }
  }
  return entry.descending ? -cmp : cmp;
}

export function stableSortInPlace<T>(arr: T[], keys: OrderKeyEntry<T>[]): void {
  const len = arr.length;
  if (len <= 1) return;

  const numKeys = keys.length;
  const keysArrays = new Array(numKeys);
  for (let k = 0; k < numKeys; k++) {
    const entry = keys[k]!;
    const keyArr = new Array(len);
    const keyFn = entry.key;
    for (let i = 0; i < len; i++) {
      keyArr[i] = keyFn(arr[i]!, i);
    }
    keysArrays[k] = keyArr;
  }

  const indices = len > 1000 ? new Int32Array(len) : new Array(len);
  for (let i = 0; i < len; i++) {
    indices[i] = i;
  }

  indices.sort((i, j) => {
    for (let k = 0; k < numKeys; k++) {
      const keyArr = keysArrays[k]!;
      const ka = keyArr[i];
      const kb = keyArr[j];
      const cmp = compareOrderKeys(ka, kb, keys[k]!);
      if (cmp !== 0) return cmp;
    }
    return i - j;
  });

  const sorted = new Array(len);
  for (let i = 0; i < len; i++) {
    sorted[i] = arr[indices[i]!]!;
  }
  for (let i = 0; i < len; i++) {
    arr[i] = sorted[i]!;
  }
}

