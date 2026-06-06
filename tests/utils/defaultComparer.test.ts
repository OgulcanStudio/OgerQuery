import { describe, it, expect } from 'vitest';
import { defaultComparer } from '../../src/utils/defaultComparer.js';

describe('defaultComparer', () => {
  it('covers all comparison paths', () => {
    expect(defaultComparer(1, 1)).toBe(0);
    expect(defaultComparer(null, null)).toBe(0);
    expect(defaultComparer(null, undefined)).toBe(0);
    expect(defaultComparer(null, 2)).toBe(-1);
    expect(defaultComparer(2, null)).toBe(1);
    expect(defaultComparer('a', 'b')).toBe(-1);
    expect(defaultComparer('b', 'a')).toBe(1);
    expect(defaultComparer('x', 'x')).toBe(0);
    expect(defaultComparer(1, 2)).toBe(-1);
    expect(defaultComparer(2, 1)).toBe(1);
    expect(defaultComparer(1n, 2n)).toBe(-1);
    expect(defaultComparer(2n, 1n)).toBe(1);
    expect(defaultComparer(true, false)).toBe(1);
    expect(defaultComparer(1, '2')).toBeLessThan(0);
    expect(defaultComparer(undefined, 1)).toBe(-1);
    expect(defaultComparer(5, 5)).toBe(0);
    expect(defaultComparer(0, -0)).toBe(0);
    expect(defaultComparer(1 as unknown as number, '1' as unknown as string)).toBe(0);
    expect(defaultComparer(NaN, NaN)).toBe(0);
    expect(
      defaultComparer(
        { toString: () => 'obj-a' },
        { toString: () => 'obj-b' },
      ),
    ).toBeLessThan(0);
  });
});
