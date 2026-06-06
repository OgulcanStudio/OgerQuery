import { describe, it, expect } from 'vitest';
import { Q, QAsync, Empty, Range, Repeat, pipe, pipeAsync } from '../../src/index.js';

describe('Q static', () => {
  it('Empty Range Repeat', () => {
    expect(Empty<number>().ToArray()).toEqual([]);
    expect(Range(1, 3).ToArray()).toEqual([1, 2, 3]);
    expect(Repeat('a', 2).ToArray()).toEqual(['a', 'a']);
    expect(() => Range(0, -1)).toThrow();
    expect(() => Repeat(1, -1)).toThrow();
    expect(Q.Empty<number>().ToArray()).toEqual([]);
    expect(Q.Range(0, 2).ToArray()).toEqual([0, 1]);
    expect(Q.Repeat(1, 1).ToArray()).toEqual([1]);
    expect(Q.From([1, 2]).Count()).toBe(2);
    expect(pipe([1, 2], (q) => q.Count())).toBe(2);
  });

  it('QAsync static helpers', async () => {
    expect(await QAsync.Empty<number>().CountAsync()).toBe(0);
    async function* one() {
      yield 1;
    }
    expect(await QAsync.From(one()).CountAsync()).toBe(1);
    expect(await pipeAsync(one(), (q) => q.CountAsync())).toBe(1);
  });
});
