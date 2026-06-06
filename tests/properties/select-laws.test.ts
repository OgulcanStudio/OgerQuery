import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Q } from '../../src/index.js';

describe('Select functor laws', () => {
  it('identity', () => {
    fc.assert(fc.property(fc.array(fc.integer()), (arr) => {
      const id = Q(arr).Select(x => x).ToArray();
      expect(id).toEqual(arr);
    }));
  });
  it('composition', () => {
    fc.assert(fc.property(fc.array(fc.integer()), (arr) => {
      const f = (x: number) => x + 1;
      const g = (x: number) => x * 2;
      const composed = Q(arr).Select(f).Select(g).ToArray();
      const direct = Q(arr).Select(x => g(f(x))).ToArray();
      expect(composed).toEqual(direct);
    }));
  });
});
