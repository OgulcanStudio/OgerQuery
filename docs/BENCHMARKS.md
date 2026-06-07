# Benchmarks — Native JavaScript vs OgerQuery

Head-to-head comparisons using the same logic expressed as native `Array` methods vs equivalent OgerQuery operators.

## Run

```bash
npm run benchmark
```

Builds and/or runs `scripts/benchmark_bun.ts` with Bun. The script warms up each scenario, averages 5 timed runs, and **asserts all runner results match** before reporting.

## Environment

| Field | Default |
|-------|---------|
| Runtime | Node ≥ 18 |
| Rows | 1,000,000 |
| Join (hash) | 500k orders × 50k customers |
| Join (naive) | 1k × 1k (`flatMap` + `find`) |
| Warmup | 3 runs (discarded) |
| Average | 5 runs |

Document CPU/OS when sharing results — numbers vary by hardware.

---

## Results Matrix

Measured on Bun 1.x, Windows, 1M rows. Numbers vary by hardware — run `npm run benchmark` locally to reproduce.

| Scenario | Native JS | OgerQuery | Winner |
|----------|-----------|-----------|--------|
| `filter → map → slice → reduce` (10k) | 10.64 ms | 0.15 ms | **OgerQuery ~73.6×** |
| `filter → map → slice` (50k) | 13.14 ms | 0.60 ms | **OgerQuery ~22.0×** |
| `filter → length` (count) | 13.19 ms | 5.09 ms | **OgerQuery ~2.6×** |
| `filter → reduce` (sum) | 16.67 ms | 4.70 ms | **OgerQuery ~3.5×** |
| `filter → mean` (average) | 15.33 ms | 3.63 ms | **OgerQuery ~4.2×** |
| `sort → slice` (top 100) | 61.96 ms | 14.55 ms | **OgerQuery ~4.3×** |
| `sort → slice` (top 1000, 2 keys) | 95.51 ms | 39.96 ms | **OgerQuery ~2.4×** |
| `filter → distinct by key` | 13.38 ms | 8.72 ms | **OgerQuery ~1.5×** |
| `groupBy` (1M rows by key) | 12.23 ms | 9.98 ms | **OgerQuery ~1.2×** |
| `Map + map` hash join (500k) | 14.50 ms | 10.20 ms | **OgerQuery ~1.4×** |
| `every` (check positive) | 4.31 ms | 2.77 ms | **OgerQuery ~1.6×** |
| `find` (deep active element search) | 3.03 ms | 3.36 ms | **Native JS ~1.1×** |

---

## Scenario Details

### Chained array methods (biggest win)

```js
// Native — allocates filtered array, mapped array, then slices
data
  .filter((r) => r.active)
  .map((r) => r.amount * 2)
  .slice(0, 10_000)
  .reduce((a, b) => a + b, 0);

// OgerQuery — single fused pass, stops at 10k
Q(data)
  .Where((r) => r.active)
  .Select((r) => r.amount * 2)
  .Take(10_000)
  .Sum();
```

Native `filter().map().slice()` creates two full intermediate arrays before slicing. OgerQuery fuses `Where` + `Select` + `Take` into one index loop and terminates early.

### Count and sum over filtered sets

```js
// Native
data.filter((r) => r.active).length;
data.filter((r) => r.active).reduce((a, r) => a + r.amount, 0);

// OgerQuery
Q(data).Where((r) => r.active).Count();
Q(data).Where((r) => r.active).Sum((r) => r.amount);
```

OgerQuery still wins but margin is smaller — full scan required, no early `Take`.

### Single-element lookups (native wins)

```js
data.find((r) => r.active);           // stops at index 0
data.some((r) => r.active);           // same

Q(data).Where((r) => r.active).First();
Q(data).Any((r) => r.active);
```

When the first element matches, native builtins have near-zero overhead. OgerQuery pipeline setup adds marginal cost — negligible in real apps, visible in micro-benchmarks.

### Sort + take (OgerQuery wins)

```js
[...data].sort((a, b) => a.amount - b.amount).slice(0, 100);

Q(data).OrderBy((r) => r.amount).Take(100).ToArray();
```

OgerQuery features a custom, highly optimized stable index sort (`stableSortInPlace`) that caches keys and uses fast typed arrays (like `Int32Array`) for large index tracks. This avoids object allocation overheads during comparison, making OgerQuery ~4.3× faster than native `sort() → slice()`.

### Join patterns

**Naive native (slow at scale):**

```js
orders.flatMap((o) => {
  const c = customers.find((c) => c.id === o.customerId);
  return c ? [{ orderId: o.id, name: c.name }] : [];
});
```

O(N×M) — benchmark uses 1k×1k only; at 500k×50k this takes minutes.

**Optimized native (fast):**

```js
const lookup = new Map(customers.map((c) => [c.id, c]));
orders.map((o) => ({ orderId: o.id, name: lookup.get(o.customerId)?.name }));
```

Hand-tuned `Map` + `map` beats `Q().Join()` on raw speed — same O(N+M) algorithm, less abstraction overhead.

**OgerQuery:**

```js
Q(orders)
  .Join(customers, (o) => o.customerId, (c) => c.id, (o, c) => ({ ... }))
  .ToArray();
```

Composable inside larger pipelines (`Where` before join, `Select` after, async parity). Trade-off: convenience and consistency vs hand-optimized one-liner.

---

## When to use what

| Use case | Recommendation |
|----------|----------------|
| Multi-step filter/map with `Take` / `First` | **OgerQuery** — fusion + early stop |
| One-shot `find` / `some` on array | **Native** — builtins are enough |
| Top-N from sorted 1M array | **OgerQuery** — custom stable sort outperforms native `sort().slice()` |
| Join inside fluent pipeline | **OgerQuery** — readable, testable, async-ready |
| One-off `Map` join hot path | **OgerQuery** — optimized hash join outpaces manual `Map` + `map` |
| Generator / async stream / non-array source | **OgerQuery** — no native `Array` equivalent |

---

## Optimization features under test

| Feature | Affects |
|---------|---------|
| Pipeline fusion | `Where` + `Select` + `Take` + `Skip` collapse |
| Array fast path | Index loops for `T[]` + fusible ops |
| Early termination | `Take`, `First`, `Any` stop iteration |
| Hash join index | `Join` / `LeftJoin` / `GroupJoin` |

---

## Custom benchmarks

```js
import { Q } from '../dist/OgerQuery.esm.js';

function compare(label, nativeFn, ogerFn) {
  const t0 = performance.now(); nativeFn(); const native = performance.now() - t0;
  const t1 = performance.now(); ogerFn();   const oger  = performance.now() - t1;
  console.log(`${label}: native ${native.toFixed(2)}ms | oger ${oger.toFixed(2)}ms`);
}
```

---

## Related

- [Pipeline Internals](./PIPELINE.md) — fusion implementation
- [README benchmarks](../README.md#benchmarks) — summary table
