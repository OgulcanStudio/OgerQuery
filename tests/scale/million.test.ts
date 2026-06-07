import { describe, it, expect } from 'vitest';
import { Q, Range } from '../../src/index.js';

const MILLION = 1_000_000;

function makeTransactions(n: number) {
  const rows = new Array<{ id: number; amount: number; tier: string }>(n);
  for (let i = 0; i < n; i++) {
    rows[i] = {
      id: i,
      amount: (i % 1000) + 0.01,
      tier: i % 3 === 0 ? 'premium' : 'standard',
    };
  }
  return rows;
}

describe('1M+ scale correctness', () => {
  it('Range + Where + Take + Sum', () => {
    const sum = Q(Range(1, MILLION))
      .Where((n) => n % 2 === 0)
      .Take(100_000)
      .Sum();
    expect(sum).toBe(10_000_100_000);
  });

  it('Where + Select + Sum on 1M transactions', () => {
    const data = makeTransactions(MILLION);
    const total = Q(data)
      .Where((t) => t.tier === 'premium')
      .Select((t) => t.amount)
      .Sum();
    const expected = data
      .filter((t) => t.tier === 'premium')
      .reduce((a, t) => a + t.amount, 0);
    expect(total).toBeCloseTo(expected, 2);
  });

  it('DistinctBy on 1M keys', () => {
    const data = makeTransactions(MILLION);
    const count = Q(data)
      .DistinctBy((t) => t.amount)
      .Count();
    expect(count).toBe(1000);
  });

  it('TakeLast stays O(n) on 1M rows', () => {
    const data = Range(1, MILLION).ToArray();
    const last = Q(data).TakeLast(5).ToArray();
    expect(last).toEqual([999_996, 999_997, 999_998, 999_999, 1_000_000]);
  });

  it('SkipLast on 1M rows', () => {
    const data = Range(1, MILLION).ToArray();
    const first = Q(data).SkipLast(MILLION - 3).Take(3).ToArray();
    expect(first).toEqual([1, 2, 3]);
  });

  it('Join 1M outer to 1k inner keys', () => {
    const customers = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `c${i}` }));
    const orders = makeTransactions(MILLION);
    const joined = Q(orders)
      .Join(
        customers,
        (o) => o.id % 1000,
        (c) => c.id,
        (o, c) => ({ orderId: o.id, customer: c.name }),
      )
      .Take(10)
      .ToArray();
    expect(joined).toHaveLength(10);
    expect(joined[0]).toHaveProperty('customer');
  });

  it('OrderBy + First on 1M rows', () => {
    const data = makeTransactions(MILLION);
    const first = Q(data).OrderBy((t) => t.amount).First();
    expect(first.amount).toBe(0.01);
  });

  it('OrderBy + Last on 1M rows', () => {
    const data = makeTransactions(MILLION);
    const last = Q(data).OrderBy((t) => t.amount).Last();
    expect(last.amount).toBe(999.01);
  });
}, 60_000);
