# OgerQuery Documentation

Enterprise reference for **OgerQuery v0.1.0** — an ultra-fast lazy sync/async query library from **[Ogulcan Studio](https://ogulcan.studio)**. Published on npm as [`ogerquery`](https://www.npmjs.com/package/ogerquery).

---

## Release Status

| Item | Value |
|------|-------|
| **Package version** | `0.1.0` |
| **npm account** | [ogulcanstudio](https://www.npmjs.com/~ogulcanstudio) |
| **Peak benchmark** | **42× faster** than native JS on 1M-row filter→map→slice→reduce |
| **Runtime deps** | **0** |
| **Node.js** | ≥ 18 |
| **Module formats** | ESM, CJS, browser IIFE |

---

## Quick Links

| I want to… | Start here |
|------------|------------|
| Install and write first query | [Getting Started](./GETTING_STARTED.md) |
| Understand architecture | [Overview](./OVERVIEW.md) |
| Look up a sync method | [Query API](./QUERY_API.md) |
| Stream async data | [Async Query](./ASYNC_QUERY.md) |
| Parse HTTP query strings safely | [API Parsing](./API.md) |
| Integrate with Express/Fetch/ORM | [Integration](./INTEGRATION.md) |
| Use Web Streams | [Stream Adapters](./STREAM_ADAPTERS.md) |
| Reproduce benchmarks | [Benchmarks](./BENCHMARKS.md) |
| Debug a pipeline | [Explain](./EXPLAIN.md) |

---

## Documentation Map

```
docs/
├── README.md              ← You are here
├── GETTING_STARTED.md     Installation, basics, terminals
├── OVERVIEW.md            Features, architecture, entry points
│
├── API Reference
│   ├── QUERY_API.md       Sync Query<T> complete reference
│   ├── ASYNC_QUERY.md     AsyncQuery<T> complete reference
│   ├── OPERATORS.md       24 lazy operators (fusible + streaming)
│   ├── MATERIALIZING.md   25 materializing operators
│   └── TERMINALS.md       42 terminal operators
│
├── Patterns & Integration
│   ├── FILTERING.md       Predicate DSL, and/or/not, JSON filters
│   ├── API.md             parseQueryString, security, pagination
│   ├── INTEGRATION.md     Node, browser, HTTP, streams
│   └── STREAM_ADAPTERS.md ReadableStream interop
│
├── Internals
│   ├── CORE.md            Types, Query class, FeaturePlugin system
│   ├── PIPELINE.md        Executor, fusion, array fast path
│   ├── SEMANTICS.md       Formal operator definitions and laws
│   └── EXPLAIN.md         Pipeline debugging utilities
│
└── Quality
    ├── ERRORS.md          Error classes, Option/Result, edge cases
    ├── BENCHMARKS.md      Performance methodology
    └── UTILITIES.md       Comparer, path, resolveIterable helpers
```

---

## Repository Layout

What lives in the repo vs what ships on npm:

| Path | In repo | In npm package | Purpose |
|------|---------|----------------|---------|
| `src/` | ✓ | — | Library source |
| `tests/` | ✓ | — | Vitest test suite |
| `docs/` | ✓ | ✓ | This documentation |
| `dist/` | gitignored | ✓ | Compiled bundles (`npm run build`) |
| `scripts/` | ✓ | — | Benchmark runner |
| `.github/` | ✓ | — | CI workflow |
| `coverage/` | gitignored | — | Test coverage output |

Generated artifacts (`dist/`, `coverage/`, logs, IDE config) are excluded via [`.gitignore`](../.gitignore).

---

## Core Concepts

### Three operator categories

| Category | When work runs | Examples |
|----------|----------------|----------|
| **Lazy** | Deferred until terminal | `Where`, `Select`, `Take`, `Skip` |
| **Materializing** | Flushes segment to memory, continues | `OrderBy`, `Join`, `Distinct`, `GroupBy` |
| **Terminal** | Executes pipeline, returns value | `ToArray`, `Sum`, `First`, `Paginate` |

### Execution model

```ts
Q(source)           // 1. Wrap source — no iteration
  .Where(...)       // 2. Append to pipeline — still no iteration
  .Select(...)      // 3. Fusion may merge adjacent ops
  .ToArray();       // 4. Terminal triggers execution
```

Pipelines are **immutable**. Each operator returns a new `Query<T>` / `AsyncQuery<T>`.

### Sync vs async

| | Sync | Async |
|---|------|-------|
| Entry | `Q(source)` | `QAsync(source)` |
| Source | `Iterable<T>` | `AsyncIterable<T>` |
| Terminal | `ToArray()` | `await ToArrayAsync()` |
| Cancellation | — | `AbortSignal` |

Both APIs expose the same 91+ operators with identical signatures (terminals suffixed with `Async`).

---

## Learning Paths

### Application developer

1. [Getting Started](./GETTING_STARTED.md) — install, chain, terminals
2. [Query API](./QUERY_API.md) — operator lookup
3. [Filtering](./FILTERING.md) — predicate DSL for object queries
4. [Integration](./INTEGRATION.md) — wire into your stack

### API / backend engineer

1. [API Parsing](./API.md) — `parseQueryString`, security options
2. [Filtering](./FILTERING.md) — JSON-serializable filter clauses
3. [Terminals](./TERMINALS.md) — `Paginate`, `CursorPage`
4. [Integration](./INTEGRATION.md) — HTTP route patterns

### Library contributor

1. [Overview](./OVERVIEW.md) — FeaturePlugin architecture
2. [Core](./CORE.md) — types, registry, OpPipeline
3. [Pipeline](./PIPELINE.md) — executor, fusion rules
4. [Semantics](./SEMANTICS.md) — formal behavior contracts

---

## Package Exports

Public API surface from `ogerquery` v0.1.0:

```ts
import {
  // Entry points
  Q, QAsync, From, FromAsync, Empty, EmptyAsync, Range, Repeat,
  pipe, pipeAsync, Query, AsyncQuery,

  // Types
  Grouping, Lookup, Predicate, Selector, Comparer, EqualityComparer,
  Indexed, Pair, PageResult, CursorPageResult,

  // Errors
  EmptySequenceError, MoreThanOneElementError,
  ArgumentOutOfRangeError, InvalidOperationError,

  // Filtering
  and, or, not, buildPredicate, fieldPredicate, predicateFromClause,
  predicates, validateFilterWithSchema, assertFilterShape,

  // HTTP / API
  parseQueryString, parseFilterJson, predicateFromParsedQuery,
  safeApiError, sanitizeFilterObject, assertAllowedField,
  assertMaxDepth, clampLimit, parsePositiveInt,

  // Pagination helpers
  DEFAULT_MAX_PAGE_SIZE, createPageResult, clampPageSize,

  // Debugging
  explainPipeline, explainPipelineText, setDebugMode, isDebugMode,

  // Functional
  some, None, ok, err, fromNullable, tryRun, tryRunSync,

  // Streams
  fromReadableStream, toReadableStream,
} from 'ogerquery';
```

---

## Version & Compatibility

| Requirement | Version |
|-------------|---------|
| **OgerQuery** | `0.1.0` |
| Node.js | ≥ 18 |
| TypeScript | ≥ 5.0 (recommended) |
| Module formats | ESM, CJS, browser IIFE |
| Production dependencies | **0** |

---

## Development & CI

From repository root:

```bash
npm install
npm test              # unit + property tests
npm run test:coverage # coverage report → coverage/ (gitignored)
npm run typecheck     # strict TypeScript
npm run build         # bundles → dist/ (gitignored)
npm run benchmark     # performance suite
```

**CI pipeline** (`.github/workflows/ci.yml`): runs on push and pull requests to `main` — typecheck, coverage tests, then build.

---

## Support

- [GitHub Issues](https://github.com/ogulcanstudio/ogerquery/issues) — bug reports and feature requests
- [Benchmarks](./BENCHMARKS.md) — reproduce performance claims locally
- [Semantics](./SEMANTICS.md) — expected behavior for edge cases
