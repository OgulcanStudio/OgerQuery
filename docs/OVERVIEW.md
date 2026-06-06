# OgerQuery — Overview

**Version 0.1.0** — lazy sync/async query library for TypeScript with fluent PascalCase chaining. Zero runtime dependencies. Operates on any `Iterable<T>` or `AsyncIterable<T>`.

## Features

- **Lazy evaluation** — operators build a pipeline; execution starts at a terminal operator
- **Sync & Async** — `Query<T>` and `AsyncQuery<T>` with identical APIs
- **100+ operators** — projection, filtering, ordering, grouping, joins, aggregation, set operations, statistics, pagination
- **Type-safe** — full TypeScript inference with generics throughout the pipeline
- **Pipeline fusion** — adjacent `Where`/`Select`/`Take`/`Skip` collapse automatically into single loops
- **Array fast path** — index-based execution for `T[]` sources with fusible ops (1–3+ op specializations)
- **Segmented execution** — lazy segments flush to arrays for materializing ops, then continue lazily
- **FeaturePlugin architecture** — every operator is a self-contained plugin with `append`, `executeSync`/`runSync`/`runAsync`, and `testCases`
- **Predicate DSL** — `WhereEq`, `WhereGt`, `WhereIn`, `WhereContains` etc. with dot-notation paths
- **Debugging** — `Explain()` / `ExplainText()` for pipeline inspection
- **AbortSignal support** — async queries support cancellation via `AbortSignal`
- **Stream adapters** — Web Streams interop (`fromReadableStream` / `toReadableStream`)
- **Filter builder** — `and`/`or`/`not` combinators + JSON-serializable filter clauses
- **Result types** — `Option` / `Result` with `tryRun` / `tryRunSync`

## Quickstart

```ts
import { Q } from "ogerquery";

const users = [
  { id: 1, name: "Alice", age: 30, active: true },
  { id: 2, name: "Bob", age: 25, active: false },
  { id: 3, name: "Carol", age: 35, active: true },
];

const adults = Q(users)
  .Where((u) => u.active)
  .OrderBy((u) => u.age)
  .Select((u) => ({ name: u.name, age: u.age }))
  .ToArray();
// [{ name: "Bob", age: 25 }, { name: "Alice", age: 30 }, { name: "Carol", age: 35 }]
```

## Async Quickstart

```ts
import { QAsync } from "ogerquery";

async function* fetchUsers() {
  yield { id: 1, name: "Alice" };
  yield { id: 2, name: "Bob" };
}

const names = await QAsync(fetchUsers())
  .Select((u) => u.name)
  .ToArrayAsync();
// ["Alice", "Bob"]
```

## Architecture

OgerQuery uses a modular **FeaturePlugin** architecture:

```
src/
├── core/
│   ├── types.ts          — TQuery, TAsyncQuery, PipelineOp, Predicate, Selector, etc.
│   ├── Q.ts              — Entry points: Q(), From(), Empty(), Range(), Repeat(), QAsync()
│   ├── Query.ts          — Sync Query<T> class (720+ lines, fluent API)
│   ├── AsyncQuery.ts     — Async Query<T> class (765+ lines, fluent API)
│   ├── OpPipeline.ts     — Ordered array of PipelineOp operations
│   ├── FeaturePlugin.ts  — FeaturePlugin interface & FeatureRegistry
│   ├── pipelineOps.ts    — PipelineOp discriminated union (48+ variants)
│   ├── executor.ts       — Sync pipeline executor with segmented + array fast path
│   └── asyncExecutor.ts  — Async pipeline executor with AbortSignal
├── features/
│   ├── lazy/             — 24 lazy operator plugins
│   ├── materializing/    — 25 materializing operator plugins
│   ├── terminal/         — 42 terminal operator plugins
│   └── registry.ts       — Feature registration for all plugins
```

## Key Concepts

### Lazy vs Materializing vs Terminal

| Category | Behavior | Examples |
|----------|----------|----------|
| **Lazy** | Build pipeline; no iteration occurs | `Where`, `Select`, `Take`, `Skip` |
| **Materializing** | Flush pipeline to array, process, continue | `OrderBy`, `GroupBy`, `Distinct`, `Join` |
| **Terminal** | Execute pipeline and return concrete result | `ToArray`, `First`, `Count`, `Sum` |

### Pipeline Fusion

Adjacent fusible operators combine into a single loop:

- `Where` + `Where` → single predicate via `&&`
- `Select` + `Select` → composed selector via function chaining
- `Take` + `Take` → `Math.min` of counts
- `Skip` + `Skip` → sum of counts

### Array Fast Path

When source is `T[]` and pipeline contains only fusible ops (`Where`, `Select`, `Take`, `Skip`), execution uses direct index-based loops instead of iterator wrappers. Specialized 1-op, 2-op, and 3-op combinations have their own paths.

### Sync Execution

Uses `*generate` functions wrapping iterator protocols with lazy operator composition (`wrapLazy`) and materializing buffer flushes (`materialize`).

### Async Execution

Uses `async *generate` with `for await` loops, `AbortSignal` checks at each step, and `resolveMaterializingOpSecond` for async materializing op resolution.

## Entry Points

| Function | Returns | Description |
|----------|---------|-------------|
| `Q(source)` | `Query<T>` | Create sync query from `Iterable<T>` |
| `Q.Empty()` | `Query<T>` | Empty sync query |
| `Q.From(source)` | `Query<T>` | Alias for `Q` |
| `Q.Range(start, count)` | `Query<number>` | Sequence of numbers |
| `Q.Repeat(value, count)` | `Query<T>` | Repeated value |
| `Q.pipe(source, fn)` | `R` | Fluent composition |
| `From(source)` | `Query<T>` | Alias for `Q` |
| `Empty<T>()` | `Query<T>` | Empty sync query |
| `Range(start, count)` | `Query<number>` | Number sequence |
| `Repeat(value, count)` | `Query<T>` | Repeated value |
| `QAsync(source)` | `AsyncQuery<T>` | Create async query |
| `QAsync.From(source)` | `AsyncQuery<T>` | Alias for `QAsync` |
| `QAsync.Empty()` | `AsyncQuery<T>` | Empty async query |
| `QAsync.pipe(source, fn)` | `Promise<R>` | Async composition |
| `FromAsync(source)` | `AsyncQuery<T>` | Alias for `QAsync` |
| `EmptyAsync<T>()` | `AsyncQuery<T>` | Empty async query |

## Requirements

| Requirement | Version |
|-------------|---------|
| **OgerQuery** | `0.1.0` |
| **Node.js** | ≥ 18 |
| **TypeScript** | ≥ 5.0 (recommended) |
| **Module formats** | ESM (`import`) and CJS (`require`) via `tsup` dual-build |
| **Production dependencies** | **0** |

## Package Exports

```ts
import {
  Q, QAsync, From, FromAsync, Empty, EmptyAsync, Range, Repeat,
  pipe, pipeAsync, Query, AsyncQuery,
  Grouping, Lookup,
  Predicate, Selector, Comparer, EqualityComparer, Indexed, Pair,
  EmptySequenceError, MoreThanOneElementError,
  ArgumentOutOfRangeError, InvalidOperationError,
  and, or, not, buildPredicate,
  parseQueryString, predicateFromParsedQuery,
  explainPipeline, setDebugMode,
  some, None, ok, err, Option, Result,
  fromReadableStream, toReadableStream,
} from "ogerquery";
```

## Design Principles

1. **No coupling** — works on any iterable (arrays, generators, streams, DB cursors)
2. **Lazy by default** — zero allocation until a terminal operator is called
3. **Fusion first** — common patterns optimize automatically with zero user input
4. **Async parity** — sync and async APIs mirror exactly; all 91+ operators available on both
5. **PascalCase naming** — consistent, idiomatic method-chaining convention
6. **Plugin isolation** — each feature is independently testable and registerable
