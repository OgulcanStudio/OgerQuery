# Getting Started

OgerQuery **v0.1.0** — first public release. This guide covers install, entry points, terminals, and local development.

## Installation

```bash
npm install ogerquery
# or
bun add ogerquery
# or
pnpm add ogerquery
# or
yarn add ogerquery
```

## Basic Usage

```ts
import { Q } from "ogerquery";

const data = [1, 2, 3, 4, 5];

const result = Q(data)
  .Where((n) => n % 2 === 0)
  .Select((n) => n * 10)
  .ToArray();

console.log(result); // [20, 40]
```

## Entry Points

| Function | Returns | Description |
|----------|---------|-------------|
| `Q(source)` | `Query<T>` | Sync query from `Iterable<T>` |
| `From(source)` | `Query<T>` | Alias for `Q` |
| `Empty<T>()` | `Query<T>` | Empty sync query |
| `Range(start, count)` | `Query<number>` | Sequence of `count` numbers from `start` |
| `Repeat(value, count)` | `Query<T>` | `value` repeated `count` times |
| `QAsync(source)` | `AsyncQuery<T>` | Async query from `AsyncIterable<T>` |
| `FromAsync(source)` | `AsyncQuery<T>` | Alias for `QAsync` |
| `EmptyAsync<T>()` | `AsyncQuery<T>` | Empty async query |

### Static helpers on `Q` and `QAsync`

```ts
Q.Empty<T>()          // same as Empty<T>()
Q.From(source)        // same as From(source)
Q.Range(0, 10)        // same as Range(0, 10)
Q.Repeat("x", 5)      // same as Repeat("x", 5)
Q.pipe(source, fn)    // same as pipe(source, fn)

QAsync.From(source)   // same as FromAsync(source)
QAsync.Empty<T>()     // same as EmptyAsync<T>()
QAsync.pipe(src, fn)  // same as pipeAsync(src, fn)
```

## Chaining Pattern

All operators return a new query (immutable pipeline). The original query is never mutated:

```ts
Q(users)
  .Where((u) => u.active)
  .OrderBy((u) => u.name)
  .Take(10)
  .Select((u) => u.email)
  .ToArray();
```

### Fluent composition with `pipe`

```ts
import { pipe } from "ogerquery";

const result = pipe([1, 2, 3, 4, 5], (q) =>
  q.Where((n) => n > 2).Select((n) => n * 10).ToArray()
);
// [30, 40, 50]
```

### Async composition with `pipeAsync`

```ts
import { pipeAsync } from "ogerquery";

const result = await pipeAsync(asyncSource, async (q) =>
  q.Where(...).Select(...).ToArrayAsync()
);
```

## Sync vs Async Examples

### Sync pipeline

```ts
import { Q } from "ogerquery";

const result = Q([5, 3, 1, 4, 2])
  .Where((n) => n > 2)
  .OrderBy((n) => n)
  .Select((n) => n.toString())
  .ToArray();
// ["3", "4", "5"]
```

### Async pipeline

```ts
import { QAsync } from "ogerquery";

async function* generate() {
  for (let i = 1; i <= 5; i++) yield i;
}

const result = await QAsync(generate())
  .Where((n) => n > 2)
  .OrderBy((n) => n)
  .Select((n) => n.toString())
  .ToArrayAsync();
// ["3", "4", "5"]
```

## Terminal Operators

Terminals execute the pipeline and return a concrete result:

```ts
// Collection
const arr = query.ToArray();
const list = query.ToList();    // Alias for ToArray
const set = query.ToSet();
const map = query.ToMap((u) => u.id, (u) => u.name);
const obj = query.ToObject((u) => u.id.toString(), (u) => u.name);
const dict = query.ToDictionary((u) => u.id);
const lookup = query.ToLookup((u) => u.role);

// Single element
const first = query.First();
const firstOrDef = query.FirstOrDefault(null);
const last = query.Last();
const lastOrDef = query.LastOrDefault(null);
const single = query.Single();
const singleOrDef = query.SingleOrDefault(null);
const elementAt = query.ElementAt(0);

// Aggregation
const count = query.Count();
const sum = query.Sum((u) => u.salary);
const avg = query.Average((u) => u.age);
const min = query.Min((u) => u.age);
const max = query.Max((u) => u.salary);
const median = query.Median((u) => u.age);
const mode = query.Mode((u) => u.role);
const p95 = query.Percentile(95, (u) => u.latency);
const agg = query.Aggregate(0, (acc, u) => acc + u.salary);
const reduced = query.Reduce((a, b) => a + b);

// Boolean
const any = query.Any((u) => u.active);
const all = query.All((u) => u.age > 18);
const contains = query.Contains("value");
const equal = query.SequenceEqual(other);
```

## Async Terminals

All terminals have `Async` suffix variants returning `Promise`:

```ts
const arr = await query.ToArrayAsync();
const first = await query.FirstAsync();
const count = await query.CountAsync();
const any = await query.AnyAsync();
const sum = await query.SumAsync((u) => u.salary);
const page = await query.PaginateAsync(1, 20);
const [matches, rest] = await query.PartitionAsync((u) => u.active);
await query.ForEachAsync(async (x) => await save(x), { concurrency: 5 });
```

## TypeScript Integration

Types flow through the pipeline automatically:

```ts
interface User {
  id: number;
  name: string;
  age: number;
  active: boolean;
}

const users: User[] = [
  { id: 1, name: "Alice", age: 30, active: true },
  { id: 2, name: "Bob", age: 25, active: false },
];

// Fully typed with inference
const names = Q(users)
  .Where((u) => u.age > 18)    // u: User
  .Select((u) => u.name)        // string
  .ToArray();                   // string[]
```

### ESM imports

```ts
import { Q, QAsync, From, Range } from "ogerquery";
```

### CJS imports

```ts
const { Q, QAsync, From, Range } = require("ogerquery");
```

## Predicate DSL

Convenience filtering methods built on `Where`:

```ts
Q(users)
  .WhereEq("role", "admin")
  .WhereGt("age", 18)
  .WhereBetween("salary", 50000, 100000)
  .WhereContains("name", "Al")
  .WhereNotNull("email")
  .ToArray();
```

Supported: `WhereEq`, `WhereNotEq`, `WhereGt`, `WhereGte`, `WhereLt`, `WhereLte`, `WhereIn`, `WhereNotIn`, `WhereBetween`, `WhereContains`, `WhereStartsWith`, `WhereEndsWith`, `WhereNull`, `WhereNotNull`, `WhereTruthy`, `WhereFalsy`.

## Pipeline Debugging

```ts
const query = Q(data).Where((x) => x > 1).Select((x) => x * 2).OrderBy((x) => x);

console.log(query.Explain());
// [{ kind: 'where', index: 0 }, { kind: 'select', index: 1 }, { kind: 'orderBy', index: 2, keys: [...] }]

console.log(query.ExplainText());
// ["where → select → orderBy"]
```

## Running Tests

From the repository root (not required for npm consumers):

```bash
npm test               # vitest run
npm run test:watch     # watch mode
npm run test:coverage  # coverage report → coverage/ (gitignored)
npm run typecheck      # tsc --noEmit
npm run build          # ESM, CJS, IIFE bundles → dist/ (gitignored)
```

Coverage and build output are excluded from git — see [`.gitignore`](../.gitignore).

## Next Steps

- [Documentation Index](./README.md) — full guide map and learning paths
- [Benchmarks](./BENCHMARKS.md) — reproduce performance locally
- [Core Architecture](./CORE.md) — types, classes, plugin system
- [Operators Reference](./OPERATORS.md) — all 24 lazy operators
- [Materializing Operators](./MATERIALIZING.md) — all 25 materializing operators
- [Terminals Reference](./TERMINALS.md) — all 42 terminal operators
- [Pipeline Internals](./PIPELINE.md) — fusion, segmented execution, fast path
- [Async Query](./ASYNC_QUERY.md) — async-specific API
