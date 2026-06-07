import { Q } from '../src/index';
import _ from 'lodash';
import * as est from 'es-toolkit';

const N = 1_000_000;
const JOIN_OUTER = 500_000;
const JOIN_INNER = 50_000;
const WARMUP = 3;
const RUNS = 5;

// Correctness checks helper
function sameResult(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return a === b;
  
  // Custom check for Grouping or Map/Set structure
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!sameResult(v, b.get(k))) return false;
    }
    return true;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) {
      if (!b.has(v)) return false;
    }
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!sameResult(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === 'object') {
    // Check if it's a Grouping (which has Key and elements) or standard object
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      if (keysA[i] !== keysB[i]) return false;
      if (!sameResult(a[keysA[i]], b[keysB[i]])) return false;
    }
    return true;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

// Convert grouping output to a uniform object structure for comparison
function normalizeGrouping(groups: any[]): any {
  // If it's a list of IGrouping/Grouping, convert to record of arrays
  if (Array.isArray(groups) && groups.length > 0 && ('Key' in groups[0] || 'key' in groups[0])) {
    const obj: any = {};
    for (const g of groups) {
      const key = g.Key !== undefined ? g.Key : g.key;
      // If g is iterable, collect it, otherwise use it
      const elements = Array.from(g);
      obj[key] = elements;
    }
    return obj;
  }
  return groups;
}

function bench(fn: () => any): { ms: number; result: any } {
  for (let i = 0; i < WARMUP; i++) {
    const res = fn();
    if (res && typeof res.then === 'function') {
      throw new Error('Async functions not supported in sync bench');
    }
  }
  const start = performance.now();
  let result;
  for (let i = 0; i < RUNS; i++) {
    result = fn();
  }
  return { ms: (performance.now() - start) / RUNS, result };
}

// Mock dataset generator
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

// Scenarios definition
const scenarios: {
  category: string;
  name: string;
  native: () => any;
  oger: () => any;
  lodash: () => any;
  estoolkit: () => any;
  normalize?: (res: any) => any;
}[] = [
  // CATEGORY 1: Filtering & Mapping
  {
    category: 'Filtering & Mapping',
    name: 'filter -> map -> slice -> reduce (Sum active * 2 of first 10k)',
    native: () =>
      data
        .filter((r) => r.active)
        .map((r) => r.amount * 2)
        .slice(0, 10_000)
        .reduce((a, b) => a + b, 0),
    oger: () =>
      Q(data)
        .Where((r) => r.active)
        .Select((r) => r.amount * 2)
        .Take(10_000)
        .Sum(),
    lodash: () =>
      _.chain(data)
        .filter((r) => r.active)
        .map((r) => r.amount * 2)
        .take(10_000)
        .sum()
        .value(),
    estoolkit: () =>
      est.sum(
        est.take(
          data.filter((r) => r.active),
          10_000
        ).map((r) => r.amount * 2)
      ),
  },
  {
    category: 'Filtering & Mapping',
    name: 'filter -> map -> slice (ToArray active of first 50k)',
    native: () => data.filter((r) => r.active).map((r) => r.amount).slice(0, 50_000),
    oger: () => Q(data).Where((r) => r.active).Select((r) => r.amount).Take(50_000).ToArray(),
    lodash: () =>
      _.chain(data)
        .filter((r) => r.active)
        .map((r) => r.amount)
        .take(50_000)
        .value(),
    estoolkit: () => est.take(data.filter((r) => r.active), 50_000).map((r) => r.amount),
  },

  // CATEGORY 2: Aggregations & Reductions
  {
    category: 'Aggregations & Reductions',
    name: 'Count (filter -> length)',
    native: () => data.filter((r) => r.active).length,
    oger: () => Q(data).Where((r) => r.active).Count(),
    lodash: () => _.filter(data, (r) => r.active).length,
    estoolkit: () => data.filter((r) => r.active).length,
  },
  {
    category: 'Aggregations & Reductions',
    name: 'Sum (filter -> sum)',
    native: () => data.filter((r) => r.active).reduce((a, r) => a + r.amount, 0),
    oger: () => Q(data).Where((r) => r.active).Sum((r) => r.amount),
    lodash: () => _.sumBy(_.filter(data, (r) => r.active), (r) => r.amount),
    estoolkit: () => est.sumBy(data.filter((r) => r.active), (r) => r.amount),
  },
  {
    category: 'Aggregations & Reductions',
    name: 'Average (filter -> mean)',
    native: () => {
      const filtered = data.filter((r) => r.active);
      return filtered.reduce((a, r) => a + r.amount, 0) / filtered.length;
    },
    oger: () => Q(data).Where((r) => r.active).Average((r) => r.amount),
    lodash: () => _.meanBy(_.filter(data, (r) => r.active), (r) => r.amount),
    estoolkit: () => est.meanBy(data.filter((r) => r.active), (r) => r.amount),
  },

  // CATEGORY 3: Sorting & Pagination
  {
    category: 'Sorting & Pagination',
    name: 'OrderBy & Take (sort -> slice top 100)',
    native: () => [...data].sort((a, b) => a.amount - b.amount).slice(0, 100),
    oger: () => Q(data).OrderBy((r) => r.amount).Take(100).ToArray(),
    lodash: () =>
      _.chain(data)
        .orderBy([(r) => r.amount], ['asc'])
        .take(100)
        .value(),
    estoolkit: () => est.take(est.sortBy(data, [(r) => r.amount]), 100),
  },
  {
    category: 'Sorting & Pagination',
    name: 'Compound OrderBy & Take (2 keys, top 1000)',
    native: () =>
      [...data]
        .sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || a.amount - b.amount)
        .slice(0, 1000),
    oger: () => Q(data).OrderByDescending((r) => r.active).ThenBy((r) => r.amount).Take(1000).ToArray(),
    lodash: () =>
      _.chain(data)
        .orderBy([(r) => r.active, (r) => r.amount], ['desc', 'asc'])
        .take(1000)
        .value(),
    estoolkit: () => est.take(est.orderBy(data, [(r) => r.active, (r) => r.amount], ['desc', 'asc']), 1000),
  },

  // CATEGORY 4: Uniqueness & Set Operations
  {
    category: 'Uniqueness & Set Operations',
    name: 'DistinctBy (filter -> distinct by id % 10k)',
    native: () => {
      const seen = new Set();
      const result = [];
      const filtered = data.filter((r) => r.active);
      for (const item of filtered) {
        const key = item.id % 10_000;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(item);
        }
      }
      return result;
    },
    oger: () => Q(data).Where((r) => r.active).DistinctBy((r) => r.id % 10_000).ToArray(),
    lodash: () => _.uniqBy(_.filter(data, (r) => r.active), (r) => r.id % 10_000),
    estoolkit: () => est.uniqBy(data.filter((r) => r.active), (r) => r.id % 10_000),
  },

  // CATEGORY 5: Grouping & Joins
  {
    category: 'Grouping & Joins',
    name: 'GroupBy (group 1M rows by amount)',
    normalize: normalizeGrouping,
    native: () => {
      const groups: Record<number, any[]> = {};
      for (const r of data) {
        (groups[r.amount] || (groups[r.amount] = [])).push(r);
      }
      return groups;
    },
    oger: () => Q(data).GroupBy((r) => r.amount).ToArray(),
    lodash: () => _.groupBy(data, (r) => r.amount),
    estoolkit: () => est.groupBy(data, (r) => r.amount),
  },
  {
    category: 'Grouping & Joins',
    name: 'Join (500k orders joined with 50k customers)',
    native: () => {
      const lookup = new Map(customers.map((c) => [c.id, c]));
      const res = [];
      for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        const c = lookup.get(o.customerId);
        if (c) {
          res.push({ orderId: o.id, name: c.name });
        }
      }
      return res;
    },
    oger: () =>
      Q(orders)
        .Join(
          customers,
          (o) => o.customerId,
          (c) => c.id,
          (o, c) => ({ orderId: o.id, name: c.name })
        )
        .ToArray(),
    lodash: () => {
      const lookup = new Map(customers.map((c) => [c.id, c]));
      return _.map(orders, (o) => ({
        orderId: o.id,
        name: lookup.get(o.customerId)?.name,
      }));
    },
    estoolkit: () => {
      const lookup = est.keyBy(customers, (c) => c.id);
      return orders.map((o) => ({
        orderId: o.id,
        name: lookup[o.customerId]?.name,
      }));
    },
  },

  // CATEGORY 6: Short-Circuiting & Search
  {
    category: 'Short-Circuiting & Search',
    name: 'All (every element checks positive amount)',
    native: () => data.every((r) => r.amount > 0),
    oger: () => Q(data).All((r) => r.amount > 0),
    lodash: () => _.every(data, (r) => r.amount > 0),
    estoolkit: () => data.every((r) => r.amount > 0),
  },
  {
    category: 'Short-Circuiting & Search',
    name: 'Find (deep search for active element at index 900k)',
    native: () => data.find((r) => r.id === 900_000 && r.active),
    oger: () => Q(data).Where((r) => r.id === 900_000 && r.active).First(),
    lodash: () => _.find(data, (r) => r.id === 900_000 && r.active),
    estoolkit: () => data.find((r) => r.id === 900_000 && r.active),
  },
];

// Execute benchmarks
console.log('\n=============================================================');
console.log('ENTERPRISE BENCHMARK RUNNER (Bun JS)');
console.log(`Dataset size: ${N.toLocaleString()} rows`);
console.log(`Runs: ${RUNS} average (with ${WARMUP} warmups)`);
console.log('=============================================================\n');

let currentCategory = '';
const summary: any[] = [];

for (const sc of scenarios) {
  if (sc.category !== currentCategory) {
    currentCategory = sc.category;
    console.log(`\n📂 Category: ${currentCategory}`);
    console.log('-'.repeat(80));
  }

  // 1. Run benchmarks
  const nativeBench = bench(sc.native);
  const ogerBench = bench(sc.oger);
  const lodashBench = bench(sc.lodash);
  const estBench = bench(sc.estoolkit);

  // 2. Correctness validation
  const norm = sc.normalize || ((x) => x);
  const vNative = norm(nativeBench.result);
  const vOger = norm(ogerBench.result);
  const vLodash = norm(lodashBench.result);
  const vEst = norm(estBench.result);

  const matchOger = sameResult(vNative, vOger);
  const matchLodash = sameResult(vNative, vLodash);
  const matchEst = sameResult(vNative, vEst);

  let correctnessStr = '';
  if (!matchOger) {
    correctnessStr += ' ✗ OGER_MISMATCH';
    process.exitCode = 1;
  }
  if (!matchLodash) correctnessStr += ' ✗ LODASH_MISMATCH';
  if (!matchEst) correctnessStr += ' ✗ ESTOOLKIT_MISMATCH';

  // 3. Compute relative speedups
  const ogerVsLodash = lodashBench.ms / ogerBench.ms;
  const ogerVsEst = estBench.ms / ogerBench.ms;
  const ogerVsNative = nativeBench.ms / ogerBench.ms;

  console.log(`📊 ${sc.name}`);
  console.log(`   Native JS:  ${nativeBench.ms.toFixed(3).padStart(8)} ms`);
  console.log(`   OgerQuery:  ${ogerBench.ms.toFixed(3).padStart(8)} ms (${ogerVsNative.toFixed(1)}x vs Native)`);
  console.log(`   Lodash:     ${lodashBench.ms.toFixed(3).padStart(8)} ms (${ogerVsLodash.toFixed(1)}x vs Lodash)`);
  console.log(`   es-toolkit: ${estBench.ms.toFixed(3).padStart(8)} ms (${ogerVsEst.toFixed(1)}x vs es-toolkit)`);
  if (correctnessStr) {
    console.log(`   ⚠️ WARNING: Correctness FAILED:${correctnessStr}`);
  }

  summary.push({
    name: sc.name,
    nativeMs: nativeBench.ms,
    ogerMs: ogerBench.ms,
    lodashMs: lodashBench.ms,
    estMs: estBench.ms,
    ogerVsNative,
    ogerVsLodash,
    ogerVsEst,
    match: matchOger,
  });
}

// Print final leaderboard summary
console.log('\n' + '='.repeat(117));
console.log('LEADERBOARD SUMMARY (Ratio > 1.0 means OgerQuery is faster)');
console.log('='.repeat(117));
console.log(
  `${'Scenario'.padEnd(50)} | ${'OgerJS'.padStart(10)} | ${'vs Native'.padStart(10)} | ${'vs Lodash'.padStart(10)} | ${'vs es-toolkit'.padStart(12)} | Winner`
);
console.log('-'.repeat(117));
for (const s of summary) {
  const ogerTime = `${s.ogerMs.toFixed(3)} ms`;
  const vsNative = `${s.ogerVsNative.toFixed(1)}x`;
  const vsLodash = `${s.ogerVsLodash.toFixed(1)}x`;
  const vsEst = `${s.ogerVsEst.toFixed(1)}x`;

  const times = [
    { name: 'OgerJS', ms: s.ogerMs },
    { name: 'Native', ms: s.nativeMs },
    { name: 'Lodash', ms: s.lodashMs },
    { name: 'es-toolkit', ms: s.estMs },
  ];
  times.sort((a, b) => a.ms - b.ms);
  const winner = times[0].name;

  console.log(
    `${s.name.slice(0, 50).padEnd(50)} | ${ogerTime.padStart(10)} | ${vsNative.padStart(10)} | ${vsLodash.padStart(10)} | ${vsEst.padStart(12)} | ${winner.padStart(10)}`
  );
}
console.log('='.repeat(117) + '\n');
