import { describe, it, expect } from 'vitest';
import { resolveIterable } from '../../src/utils/resolveIterable.js';

describe('resolveIterable', () => {
  it('resolves standard sync iterable', async () => {
    const iterable = [1, 2, 3];
    const res = await resolveIterable(iterable);
    expect([...res]).toEqual([1, 2, 3]);
  });

  it('resolves async iterable by buffering it into an array', async () => {
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 10;
        yield 20;
      },
    };
    const res = await resolveIterable(asyncIterable);
    expect([...res]).toEqual([10, 20]);
  });
});
