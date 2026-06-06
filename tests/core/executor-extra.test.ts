import { describe, it, expect } from 'vitest';
import { Q } from '../../src/index.js';
import { Grouping, Lookup } from '../../src/index.js';

describe('executor edge cases', () => {
  it('distinct with comparer', () => {
    expect(Q([1, 1]).Distinct((a, b) => a === b).ToArray()).toEqual([1]);
  });
  it('grouping and lookup', () => {
    const g = new Grouping('k', [1]);
    expect([...g]).toEqual([1]);
    expect(g.toArray()).toEqual([1]);
    const l = new Lookup([['a', [1]]]);
    expect(l.contains('a')).toBe(true);
    expect(l.get('a').toArray()).toEqual([1]);
    expect(l.count()).toBe(1);
    expect([...l][0]?.key).toBe('a');
  });
  it('toDictionary duplicate key throws', () => {
    expect(() => Q([{k:1},{k:1}]).ToDictionary(x => x.k)).toThrow();
  });
  it('iterable source not array', () => {
    function* g() { yield 1; yield 2; }
    expect(Q(g()).Where(x => x > 0).Select(x => x * 2).Take(1).ToArray()).toEqual([2]);
  });
  it('orderBy stable tie', () => {
    expect(Q([{i:0,v:1},{i:1,v:1}]).OrderBy(x => x.v).Select(x => x.i).ToArray()).toEqual([0,1]);
  });
});
