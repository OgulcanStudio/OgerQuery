import type { Comparer } from '../core/types.js';

export const defaultComparer: Comparer<unknown> = (a, b) => {
  if (Object.is(a, b)) return 0;
  if (a == null) {
    return b == null ? 0 : -1;
  }
  if (b == null) {
    return 1;
  }
  const ta = typeof a;
  const tb = typeof b;
  if (ta === tb) {
    if (ta === 'string' || ta === 'number' || ta === 'bigint') {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    }
  }
  const sa = String(a);
  const sb = String(b);
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
};
