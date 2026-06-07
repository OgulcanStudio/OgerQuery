import type { EqualityComparer, Selector } from '../core/types.js';

export type JoinLookup<TInner, TKey> = {
  map: Map<unknown, TInner | TInner[]>;
  obj?: Record<string | number, TInner | TInner[]> | undefined;
  arr?: (TInner | TInner[])[] | undefined;
  useArr: boolean;
  useObj: boolean;
  get(key: TKey): TInner | TInner[] | undefined;
};

export function buildJoinLookup<TInner, TKey>(
  inner: Iterable<TInner>,
  innerKeySelector: Selector<TInner, TKey>,
  comparer?: EqualityComparer<TKey>,
): {
  lookup: JoinLookup<TInner, TKey>;
  eq: EqualityComparer<TKey>;
  isDefault: boolean;
  hasDuplicates: boolean;
} {
  const isDefault = comparer === undefined;
  const eq = comparer ?? (Object.is as EqualityComparer<TKey>);
  const map = new Map<unknown, TInner | TInner[]>();
  let hasDuplicates = false;

  let allIntegerKeys = true;
  let allStringOrNumberKeys = true;
  let maxKey = 0;

  const innerArr = Array.isArray(inner) ? inner : Array.from(inner);
  const len = innerArr.length;

  const keys = new Array(len);
  for (let i = 0; i < len; i++) {
    const item = innerArr[i]!;
    const key = innerKeySelector(item, i);
    keys[i] = key;

    const t = typeof key;
    if (t === 'number') {
      const num = key as number;
      if (!Number.isInteger(num) || num < 0 || num > 5_000_000) {
        allIntegerKeys = false;
      } else if (num > maxKey) {
        maxKey = num;
      }
    } else if (t === 'string') {
      allIntegerKeys = false;
    } else {
      allIntegerKeys = false;
      allStringOrNumberKeys = false;
    }
  }

  const useArr = isDefault && allIntegerKeys && len > 0;
  const useObj = isDefault && !useArr && allStringOrNumberKeys && len > 0;

  const arr: (TInner | TInner[])[] | undefined = useArr ? new Array(maxKey + 1) : undefined;
  const obj: Record<string | number, TInner | TInner[]> | undefined = useObj ? Object.create(null) : undefined;

  for (let i = 0; i < len; i++) {
    const item = innerArr[i]!;
    const key = keys[i];

    // Map insert
    const valMap = map.get(key);
    if (valMap === undefined) {
      map.set(key, item);
    } else if (Array.isArray(valMap)) {
      valMap.push(item);
    } else {
      hasDuplicates = true;
      map.set(key, [valMap, item]);
    }

    // Array insert
    if (useArr) {
      const k = key as number;
      const valArr = arr![k];
      if (valArr === undefined) {
        arr![k] = item;
      } else if (Array.isArray(valArr)) {
        valArr.push(item);
      } else {
        arr![k] = [valArr, item];
      }
    }

    // Object insert
    if (useObj) {
      const k = key as string | number;
      const valObj = obj![k];
      if (valObj === undefined) {
        obj![k] = item;
      } else if (Array.isArray(valObj)) {
        valObj.push(item);
      } else {
        obj![k] = [valObj, item];
      }
    }
  }

  const get = (key: TKey): TInner | TInner[] | undefined => {
    if (useArr) {
      return arr![key as number];
    }
    if (useObj) {
      return obj![key as any];
    }
    return map.get(key);
  };

  return {
    lookup: { map, obj, arr, useArr, useObj, get },
    eq,
    isDefault,
    hasDuplicates,
  };
}

export function findJoinMatches<TInner, TKey>(
  lookup: JoinLookup<TInner, TKey>,
  key: TKey,
  eq: EqualityComparer<TKey>,
  isDefault = false,
): TInner[] {
  if (isDefault) {
    const val = lookup.get(key);
    if (val === undefined) return [];
    return Array.isArray(val) ? val : [val];
  }
  const matches: TInner[] = [];
  for (const [storedKey, val] of lookup.map) {
    if (eq(storedKey as TKey, key)) {
      if (Array.isArray(val)) {
        const vLen = val.length;
        for (let i = 0; i < vLen; i++) {
          matches.push(val[i]!);
        }
      } else {
        matches.push(val);
      }
    }
  }
  return matches;
}
