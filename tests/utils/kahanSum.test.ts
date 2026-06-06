import { describe, it, expect } from 'vitest';
import { Q } from '../../src/index.js';
import { KahanSum } from '../../src/utils/kahanSum.js';

describe('Kahan summation', () => {
  it('reduces drift vs naive sum on many small values', () => {
    const n = 1_000_000;
    const values = Array.from({ length: n }, () => 0.1);

    let naive = 0;
    for (const v of values) naive += v;

    const kahan = new KahanSum();
    for (const v of values) kahan.add(v);

    expect(naive).not.toBe(100_000);
    expect(kahan.value).toBeCloseTo(100_000, 4);
  });

  it('Sum terminal uses compensated accumulation', () => {
    const values = Array.from({ length: 1_000_000 }, (_, i) => (i % 10) * 0.01);
    const sum = Q(values).Sum();
    const expected = values.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(expected, 4);
  });
});
