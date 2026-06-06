import { describe, it, expect } from 'vitest';
import { compareWith, equalsWith } from '../../src/utils/comparer.js';

describe('comparer utils', () => {
  it('compareWith and equalsWith', () => {
    expect(compareWith(1, 2)).toBeLessThan(0);
    expect(equalsWith(1, 1)).toBe(true);
  });
});
