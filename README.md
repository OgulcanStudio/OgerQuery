# OgerQuery

**Ultra-fast lazy query engine for JavaScript & TypeScript — from [Ogulcan Studio](https://ogulcan.studio).**

[![npm version](https://img.shields.io/npm/v/ogerquery?style=flat)](https://www.npmjs.com/package/ogerquery)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat)](package.json)

Fluent PascalCase chaining over any `Iterable` or `AsyncIterable`. Pipeline fusion. O(N) hash joins. **Zero runtime dependencies.**

```ts
import { Q } from 'ogerquery';

// Same logic as filter().map().slice().reduce() — but 73× faster on 1M rows
const total = Q(millionRows)
  .Where((r) => r.active)
  .Select((r) => r.amount * 2)
  .Take(10_000)
  .Sum();
```

---

## The Speed Story

OgerQuery is built around what backend and data teams feel first: **how fast chained filter / map / slice pipelines run on real datasets**.

We benchmark head-to-head against **native JavaScript `Array` methods** — same logic, same output, no cherry-picking. Run it yourself:

```bash
npm run benchmark
```

### Verified results — Bun 1.x, 1,000,000 rows, 5-run average

| Speed signal | Result |
|--------------|--------|
| **Peak win vs native JS** | **73× faster** — chained filter → map → slice → reduce |
| **Large slice pipeline** | **22× faster** — filter → map → take 50k rows |
| **Full-scan count** | **2.6× faster** — count filtered rows |
| **Full-scan sum** | **3.5× faster** — sum filtered amounts |
| **Dedup pipeline** | **1.5× faster** — unique keys via Set equivalent |
| **Correctness gate** | All 11 scenarios assert identical native vs OgerQuery output |
| **Runtime deps** | **0** |
| **Browser bundle** | ~103 KB minified IIFE |

### Headline benchmark — the one that makes people stop scrolling

**Scenario:** filter active rows → map amounts → take first 10k → sum

```
Native JS   ████████████████████  10.64 ms
OgerQuery   ▏                      0.15 ms   ← 73× faster
```

| | Native `Array` chain | OgerQuery pipeline | Speedup |
|---|---------------------|-------------------|---------|
| **Time** | **10.64 ms** | **0.15 ms** | **73.6×** |
| **Code** | `.filter().map().slice().reduce()` | `.Where().Select().Take().Sum()` | Same result |
| **Why native loses** | Builds full filtered + mapped arrays before slicing | Single fused loop, stops at 10k |

### Full benchmark matrix

| Scenario | Native JS | OgerQuery | Winner |
|----------|-----------|-----------|--------|
| `filter → map → slice → reduce` (10k) | 10.64 ms | 0.15 ms | **OgerQuery ~73.6×** |
| `filter → map → slice` (50k) | 13.14 ms | 0.60 ms | **OgerQuery ~22.0×** |
| `filter → length` (count active) | 13.19 ms | 5.09 ms | **OgerQuery ~2.6×** |
| `filter → reduce` (sum) | 16.67 ms | 4.70 ms | **OgerQuery ~3.5×** |
| `filter → map → Set` (dedup) | 13.38 ms | 8.72 ms | **OgerQuery ~1.5×** |
| `sort → slice` (top 100) | 61.96 ms | 14.55 ms | **OgerQuery ~4.3×** |
| `Map + map` hash join (500k) | 14.50 ms | 10.20 ms | **OgerQuery ~1.4×** |
| `find` / `some` (first match) | ~0 ms | ~0 ms | Tie |

Numbers vary by CPU/OS — **reproduce locally** with `npm run benchmark`. Full methodology: [docs/BENCHMARKS.md](docs/BENCHMARKS.md).

### Why OgerQuery destroys native chains here

Native `filter().map().slice()` **allocates two full intermediate arrays** on 1M rows before you ever slice. OgerQuery **fuses** adjacent `Where` + `Select` + `Take` into **one index loop** and **stops early** — no wasted work, no GC pressure.

```ts
// Native — 10.64 ms on 1M rows (creates 2 intermediate arrays)
data
  .filter((r) => r.active)
  .map((r) => r.amount * 2)
  .slice(0, 10_000)
  .reduce((a, b) => a + b, 0);

// OgerQuery — 0.15 ms (single fused pass, early stop)
Q(data)
  .Where((r) => r.active)
  .Select((r) => r.amount * 2)
  .Take(10_000)
  .Sum();
```

---

## Install

### npm (recommended)

```bash
npm install ogerquery
# bun add ogerquery
# pnpm add ogerquery
```

Published by **[Ogulcan Studio](https://www.npmjs.com/~ogulcanstudio)** — same team behind [`ogulcan-ui`](https://www.npmjs.com/package/ogulcan-ui).

### CDN (browser, zero build step)

```html
<script src="https://cdn.jsdelivr.net/npm/ogerquery@0.2.0/dist/OgerQuery.min.js"></script>
<script>
  const result = OgerQuery.Q([1, 2, 3, 4, 5])
    .Where((n) => n > 2)
    .Select((n) => n * 10)
    .ToArray();
  // [30, 40, 50]
</script>
```

### TypeScript / Node

```ts
import { Q, QAsync } from 'ogerquery';

const topEmails = Q(users)
  .Where((u) => u.active)
  .OrderBy((u) => u.createdAt)
  .Select((u) => u.email)
  .Take(10)
  .ToArray();

const errors = await QAsync(logStream)
  .Where((e) => e.level === 'error')
  .Take(100)
  .ToArrayAsync();
```

**Requirements:** Node.js ≥ 18, Bun, Deno, or any ES2015+ browser.

---

## Table of Contents

- [Why Teams Choose OgerQuery](#why-teams-choose-ogerquery)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Operator Overview](#operator-overview)
- [Enterprise Features](#enterprise-features)
- [Development](#development)
- [Publish to npm](#publish-to-npm)
- [License](#license)

---

## Why Teams Choose OgerQuery

| Requirement | OgerQuery v0.2.0 |
|-------------|------------------|
| **Raw speed on chained pipelines** | Up to **73× faster** than native `Array` methods |
| **Lazy evaluation** | No intermediate arrays until a terminal runs |
| **Pipeline fusion** | `Where` / `Select` / `Take` / `Skip` collapse into one pass |
| **Array fast path** | Index-based loops for `T[]` + fusible ops |
| **Sync/async parity** | 91+ operators on `Query<T>` and `AsyncQuery<T>` |
| **Any iterable** | Arrays, generators, DB cursors, `ReadableStream`, DOM lists |
| **Type-safe** | Full generic inference through the pipeline |
| **Zero deps** | Nothing to audit, nothing to patch |
| **Tree-shakeable** | ESM, CJS, and browser IIFE builds |

Works on arrays, generators, Sets, Maps, DOM `NodeList`, database cursors, `ReadableStream`, and any custom iterable.

---

## Quick Start

### Sync pipeline

```ts
import { Q } from 'ogerquery';

const result = Q([5, 3, 1, 4, 2])
  .Where((n) => n > 2)
  .OrderBy((n) => n)
  .Select((n) => n * 10)
  .ToArray();
// [30, 40, 50]
```

### Predicate DSL

```ts
Q(users)
  .WhereEq('role', 'admin')
  .WhereGt('age', 18)
  .WhereIn('status', ['active', 'pending'])
  .ToArray();
```

### Hash join

```ts
const details = Q(orders)
  .Join(
    customers,
    (o) => o.customerId,
    (c) => c.id,
    (o, c) => ({ orderId: o.id, customerName: c.name, total: o.amount }),
  )
  .ToArray();
```

### Async streaming

```ts
import { QAsync } from 'ogerquery';

const rows = await QAsync(db.cursor('SELECT * FROM events'))
  .Where((e) => e.severity >= 3)
  .Select((e) => ({ id: e.id, msg: e.message }))
  .Take(500)
  .ToArrayAsync();
```

### HTTP API integration

```ts
import { Q, parseQueryString, predicateFromParsedQuery } from 'ogerquery';

const { filter, page, pageSize } = parseQueryString(request.url);
const predicate = predicateFromParsedQuery(filter);

const pageResult = Q(db.getProducts())
  .Where(predicate)
  .Paginate(page ?? 1, pageSize ?? 20);
```

---

## Documentation

Full docs in [`docs/`](docs/) — shipped with the npm package.

| Guide | Description |
|-------|-------------|
| [**Getting Started**](docs/GETTING_STARTED.md) | Install, entry points, terminals |
| [**Overview**](docs/OVERVIEW.md) | Architecture, lazy vs materializing |
| [**Query API**](docs/QUERY_API.md) | Complete sync operator reference |
| [**Async Query**](docs/ASYNC_QUERY.md) | `QAsync`, `AbortSignal`, async terminals |
| [**Benchmarks**](docs/BENCHMARKS.md) | Reproduce every number locally |
| [**Integration**](docs/INTEGRATION.md) | Node, browser, HTTP, ORMs |
| [**Filtering**](docs/FILTERING.md) | Predicate DSL, JSON filters |
| [**API Parsing**](docs/API.md) | Secure `parseQueryString` |

---

## Operator Overview

| Category | Examples |
|----------|----------|
| **Filter / project** | `Where`, `Select`, `SelectMany`, `OfType`, `Cast` |
| **Partition** | `Take`, `Skip`, `TakeWhile`, `SkipWhile` |
| **Ordering** | `OrderBy`, `ThenBy`, `Reverse` |
| **Grouping** | `GroupBy`, `Distinct`, `DistinctBy` |
| **Joins** | `Join`, `LeftJoin`, `RightJoin`, `FullJoin`, `GroupJoin`, `Zip` |
| **Set ops** | `Union`, `Intersect`, `Except`, `Concat` |
| **Aggregation** | `Sum`, `Average`, `Median`, `Percentile`, `CountBy` |
| **Pagination** | `Paginate`, `CursorPage` |

All sync operators have `*Async` terminal variants.

---

## Enterprise Features

- **Secure query parsing** — depth limits, field allowlists, limit clamping
- **Schema validation** — `validateFilterWithSchema` for typed API filters
- **Cursor pagination** — stable large-dataset paging
- **Cancellation** — `AbortSignal` on async pipelines
- **Web Streams** — `fromReadableStream` / `toReadableStream`
- **Property-tested** — functor/filter laws via fast-check
- **CI quality gates** — typecheck, coverage, build on every push

---

## Development

```bash
git clone https://github.com/OgulcanStudio/OgerQuery.git
cd OgerQuery
npm install
npm test              # unit + property tests
npm run typecheck     # strict TypeScript
npm run build         # ESM, CJS, IIFE → dist/
npm run benchmark     # prove the speed claims yourself
```

---

## Publish to npm

Package is configured for the **[ogulcanstudio](https://www.npmjs.com/~ogulcanstudio)** npm account (same as `ogulcan-ui`).

```bash
npm login                    # log in as ogulcanstudio
npm run build
npm publish --access public  # prepack runs build automatically
```

`package.json` includes `author`, `repository`, `homepage`, `bugs`, and `publishConfig` matching Ogulcan Studio standards.

---

## License

[MIT](LICENSE) © [Ogulcan Studio](https://ogulcan.studio)
