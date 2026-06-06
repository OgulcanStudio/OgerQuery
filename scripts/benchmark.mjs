import { Q } from '../dist/OgerQuery.esm.js';

const N = 1_000_000;
const JOIN_OUTER = 500_000;
const JOIN_INNER = 50_000;
const WARMUP = 3;
const RUNS = 5;

function sameResult(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

function bench(fn) {
  for (let i = 0; i < WARMUP; i++) fn();
  const start = performance.now();
  let result;
  for (let i = 0; i < RUNS; i++) result = fn();
  return { ms: (performance.now() - start) / RUNS, result };
}

function compare(label, nativeFn, ogerFn) {
  const native = bench(nativeFn);
  const oger = bench(ogerFn);
  const match = sameResult(native.result, oger.result);
  if (!match) {
    console.error(`\n✗ CORRECTNESS FAIL: ${label}`);
    console.error('  Native result:', native.result);
    console.error('  OgerQuery result:', oger.result);
    process.exitCode = 1;
  }
  const noise = 0.05;
  const tie = native.ms < noise && oger.ms < noise;
  const ogerFaster = !tie && oger.ms < native.ms;
  const factor = tie
    ? 1
    : Number((ogerFaster ? native.ms / oger.ms : oger.ms / native.ms).toFixed(1));
  const verdict = tie ? 'tie (~0 ms)' : `${ogerFaster ? 'OgerQuery' : 'Native JS'} ${factor}x faster`;
  console.log(`\n${label}`);
  console.log(`  Native JS   ${native.ms.toFixed(2).padStart(8)} ms`);
  console.log(`  OgerQuery   ${oger.ms.toFixed(2).padStart(8)} ms`);
  console.log(`  → ${verdict}${match ? '' : ' [RESULT MISMATCH]'}`);
  return { label, nativeMs: native.ms, ogerMs: oger.ms, ogerFaster, tie, factor, match };
}

const data = Array.from({ length: N }, (_, i) => ({
  id: i,
  amount: (i % 100) + 1,
  active: i % 2 === 0,
}));

const customers = Array.from({ length: JOIN_INNER }, (_, i) => ({
  id: i,
  name: `Customer-${i}`,
}));

const orders = Array.from({ length: JOIN_OUTER }, (_, i) => ({
  id: i,
  customerId: i % JOIN_INNER,
  amount: (i % 100) + 1,
}));

console.log('\nOgerQuery vs Native JavaScript');
console.log(`Runtime: ${process.version} | Rows: ${N.toLocaleString()} | Runs: ${RUNS} (avg)`);
console.log('═'.repeat(62));

const results = [];

results.push(compare(
  'filter → map → slice → reduce (sum first 10k active)',
  () =>
    data
      .filter((r) => r.active)
      .map((r) => r.amount * 2)
      .slice(0, 10_000)
      .reduce((a, b) => a + b, 0),
  () =>
    Q(data)
      .Where((r) => r.active)
      .Select((r) => r.amount * 2)
      .Take(10_000)
      .Sum(),
));

results.push(compare(
  'filter → map → slice (first 50k active amounts)',
  () => data.filter((r) => r.active).map((r) => r.amount).slice(0, 50_000),
  () => Q(data).Where((r) => r.active).Select((r) => r.amount).Take(50_000).ToArray(),
));

results.push(compare(
  'filter → length (count active)',
  () => data.filter((r) => r.active).length,
  () => Q(data).Where((r) => r.active).Count(),
));

results.push(compare(
  'filter → reduce (sum active amounts)',
  () => data.filter((r) => r.active).reduce((a, r) => a + r.amount, 0),
  () => Q(data).Where((r) => r.active).Sum((r) => r.amount),
));

results.push(compare(
  'find (first active row)',
  () => data.find((r) => r.active),
  () => Q(data).Where((r) => r.active).First(),
));

results.push(compare(
  'some (any active)',
  () => data.some((r) => r.active),
  () => Q(data).Any((r) => r.active),
));

results.push(compare(
  'every (all have positive amount)',
  () => data.every((r) => r.amount > 0),
  () => Q(data).All((r) => r.amount > 0),
));

results.push(compare(
  'sort → slice (top 100 by amount)',
  () => [...data].sort((a, b) => a.amount - b.amount).slice(0, 100),
  () => Q(data).OrderBy((r) => r.amount).Take(100).ToArray(),
));

results.push(compare(
  'filter → map (unique keys via Set)',
  () => [...new Set(data.filter((r) => r.active).map((r) => r.id % 10_000))],
  () => Q(data).Where((r) => r.active).DistinctBy((r) => r.id % 10_000).Select((r) => r.id % 10_000).ToArray(),
));

// flatMap + find is O(N×M) — small set only; shows cost of naive array join
const smallOrders = orders.slice(0, 1_000);
const smallCustomers = customers.slice(0, 1_000);
results.push(compare(
  'flatMap + find (naive join, 1k × 1k)',
  () =>
    smallOrders.flatMap((o) => {
      const c = smallCustomers.find((c) => c.id === o.customerId);
      return c ? [{ orderId: o.id, name: c.name }] : [];
    }),
  () =>
    Q(smallOrders)
      .Join(
        smallCustomers,
        (o) => o.customerId,
        (c) => c.id,
        (o, c) => ({ orderId: o.id, name: c.name }),
      )
      .ToArray(),
));

results.push(compare(
  'Map + map (hash join — optimized native)',
  () => {
    const lookup = new Map(customers.map((c) => [c.id, c]));
    return orders.map((o) => ({
      orderId: o.id,
      name: lookup.get(o.customerId)?.name,
    }));
  },
  () =>
    Q(orders)
      .Join(
        customers,
        (o) => o.customerId,
        (c) => c.id,
        (o, c) => ({ orderId: o.id, name: c.name }),
      )
      .ToArray(),
));

console.log('\n' + '═'.repeat(62));
console.log('Summary\n');
for (const r of results) {
  const tag = r.tie ? 'tie' : r.ogerFaster ? `OgerQuery ${r.factor}x` : `Native JS ${r.factor}x`;
  const status = r.match ? tag : `${tag} [MISMATCH]`;
  console.log(`  ${status.padEnd(22)} ${r.label}`);
}
const failed = results.filter((r) => !r.match).length;
if (failed > 0) {
  console.error(`\n✗ ${failed} scenario(s) produced mismatched results.`);
  process.exitCode = 1;
} else {
  console.log('\n✓ All scenarios produce equivalent results.');
}
console.log('\nReproduce: npm run benchmark\n');
