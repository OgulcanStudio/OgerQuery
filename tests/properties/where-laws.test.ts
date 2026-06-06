import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Q } from '../../src/index.js';

describe('Where filter laws', () => {
  it('idempotent', () => {
    fc.assert(fc.property(fc.array(fc.integer()), fc.boolean(), (arr, flag) => {
      const p = (x: number) => x % 2 === (flag ? 0 : 1);
      const once = Q(arr).Where(p).ToArray();
      const twice = Q(arr).Where(p).Where(p).ToArray();
      expect(twice).toEqual(once);
    }));
  });
  it('commutative', () => {
    fc.assert(fc.property(fc.array(fc.integer()), (arr) => {
      const a = Q(arr).Where(x => x > 0).Where(x => x < 10).ToArray();
      const b = Q(arr).Where(x => x < 10).Where(x => x > 0).ToArray();
      expect(a).toEqual(b);
    }));
  });
});
