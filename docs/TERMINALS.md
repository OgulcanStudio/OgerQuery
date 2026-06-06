# Terminal Operators

All 42 terminal operators. Terminals execute the pipeline and return a concrete result. All terminals have async variants with `Async` suffix returning `Promise`.

## Collection Terminals

### ToArray / ToList

```ts
const arr: T[] = query.ToArray();
const list: T[] = query.ToList(); // Alias
```

Materializes entire pipeline to array.

### ToSet

```ts
const set: Set<T> = query.ToSet();
```

Unique elements (uses `Object.is` equality).

### ToMap / ToDictionary

```ts
const map: Map<K, V> = query.ToMap(keySel, elementSel?);
const dict: Map<K, V> = query.ToDictionary(keySel, elementSel?); // Alias
```

Builds `Map<K, V>` from key/element selectors. Later keys overwrite earlier.

### ToObject

```ts
const obj: Record<K, V> = query.ToObject(keySel, elementSel?);
```

Plain JavaScript object with string keys.

### ToLookup

```ts
const lookup: Lookup<K, V> = query.ToLookup(keySel, elementSel?);
```

Multi-map where each key maps to `V[]`. `Lookup` has:
- `.get(key)` → `IGrouping<K, V>` (empty grouping if key missing)
- `.contains(key)` → `boolean`
- `.count()` → `number`
- `[Symbol.iterator]()` → `Iterator<IGrouping<K, V>>`

## Element Terminals

### First / FirstOrDefault / FirstOrThrow

```ts
const first: T = query.First();                       // First element
const first: T = query.First((x) => x.id > 5);        // First matching
const first: T = query.FirstOrDefault(null);           // Default if empty
const first: T = query.FirstOrThrow();                 // Throws if empty
```

- `First`: throws `EmptySequenceError` if empty
- `FirstOrDefault`: returns `defaultValue` if empty
- `FirstOrThrow`: throws `EmptySequenceError` if empty (explicit name variant)

### Last / LastOrDefault / LastOrThrow

```ts
const last: T = query.Last();
const last: T = query.LastOrDefault(null);
const last: T = query.LastOrThrow();
```

- `Last`: throws `EmptySequenceError` if empty
- `LastOrDefault`: returns `defaultValue` if empty
- `LastOrThrow`: throws `EmptySequenceError` if empty

Materializes to find last element after pipeline.

### Single / SingleOrDefault / SingleOrThrow

```ts
const single: T = query.Single();
const single: T = query.SingleOrDefault(null);
const single: T = query.SingleOrThrow();
```

- `Single`: throws `EmptySequenceError` if empty, `MoreThanOneElementError` if >1 match
- `SingleOrDefault`: returns default if empty, throws `MoreThanOneElementError` if >1
- `SingleOrThrow`: throws `EmptySequenceError` if empty, `MoreThanOneElementError` if >1

### ElementAt / ElementAtOrDefault

```ts
const item: T = query.ElementAt(0);        // First element
const item: T = query.ElementAtOrDefault(100, defaultItem);
```

- `ElementAt`: throws `ArgumentOutOfRangeError` if index < 0 or out of bounds
- `ElementAtOrDefault`: returns default if out of bounds

## Aggregation Terminals

### Count / LongCount

```ts
const count: number = query.Count();
const activeCount: number = query.Count((x) => x.active);
const longCount: number = query.LongCount(); // Alias
```

Returns 0 if empty. `LongCount` is an alias for API completeness.

### CountBy

```ts
const counts: Map<K, number> = query.CountBy((x) => x.role);
// Map { "admin" => 5, "user" => 100 }
```

Frequency map: counts occurrences of each key.

### Sum

```ts
const sum: number = query.Sum();                // Elements must be numbers
const sum: number = query.Sum((x) => x.price);  // Projected sum
```

Returns 0 if empty.

### Average

```ts
const avg: number = query.Average();
const avgAge: number = query.Average((x) => x.age);
```

Throws `EmptySequenceError` if empty.

### Min / Max

```ts
const min: number = query.Min();
const max: number = query.Max((x) => x.score);
```

Throws `EmptySequenceError` if empty.

### MinBy / MaxBy

```ts
const youngest: T = query.MinBy((x) => x.age);
const oldest: T = query.MaxBy((x) => x.age);
```

Throws `EmptySequenceError` if empty. Returns the element with the min/max key.

### Median

```ts
const median: number = query.Median();
const medianAge: number = query.Median((x) => x.age);
```

Throws if empty. For even count, returns average of the two middle values.

### Mode

```ts
const mode: T = query.Mode();                       // Most frequent element
const modeRole: string = query.Mode((x) => x.role);  // Most frequent role
```

Throws if empty. Returns first element if there's a tie.

### Percentile

```ts
const p95: number = query.Percentile(95);
const p95Latency: number = query.Percentile(95, (x) => x.latency);
```

Percentile value from 0–100. Throws if empty. Uses linear interpolation between sorted values.

### Aggregate

```ts
const result = query.Aggregate("", (acc, x) => acc + x.name + ",");
```

Returns seed if empty. No selector overload — always takes seed + func.

### Reduce

```ts
const sum = query.Reduce((a, b) => a + b);       // Without seed: first element as seed
const sum = query.Reduce(0, (a, b) => a + b);    // With seed
```

Without seed, throws `EmptySequenceError` on empty. With seed, returns seed on empty.

## Quantifier Terminals

### Any

```ts
const hasAny: boolean = query.Any();
const hasActive: boolean = query.Any((x) => x.active);
```

Returns `true` if any element exists (or any matches predicate). Short-circuits.

### All

```ts
const allActive: boolean = query.All((x) => x.active);
```

Returns `true` on empty (vacuous truth). Short-circuits on first `false`.

### Contains

```ts
const hasValue: boolean = query.Contains("test");
const hasUser: boolean = query.Contains(user, (a, b) => a.id === b.id);
```

Linear search. Short-circuits on first match.

### SequenceEqual

```ts
const equal: boolean = query.SequenceEqual(otherArray);
const equal: boolean = query.SequenceEqual(other, (a, b) => a.id === b.id);
```

Pairwise comparison; lengths must match exactly.

## Conversion Terminals

### Partition

```ts
const [matches, nonMatches]: [T[], T[]] = query.Partition((x) => x.active);
```

Single pass. `matches` contains elements where predicate is true, `nonMatches` where false. Both preserve relative order.

### SplitAt

```ts
const [prefix, suffix]: [T[], T[]] = query.SplitAt(5);
// prefix: first 5 elements, suffix: rest
```

Index is clamped to `[0, length]`.

## Pagination Terminals

### Paginate

```ts
const result: PageResult<T> = query.Paginate(1, 20, 100);
// { items: T[], page: 1, pageSize: 20, total: 150, totalPages: 8, hasNext: true, hasPrevious: false }
```

Materializes entire pipeline to compute total count. Page is 1-indexed (clamped to ≥1). `maxPageSize` defaults to 1000.

### CursorPage

```ts
const result: CursorPageResult<T> = query.CursorPage(20, "cursor123");
// { items: T[], nextCursor: string | null, hasNext: boolean }
```

Index-based cursor: cursor is stringified numeric offset. Starts from cursor position or 0 if no cursor.

## Iteration Terminal

### ForEach

```ts
query.ForEach((item, index) => console.log(index, item));
```

Synchronous iteration. Returns `void`.

```ts
await query.ForEachAsync(
  async (item) => await process(item),
  { concurrency: 5, signal: abortController.signal }
);
```

Async variant supports:
- `concurrency` — max parallel operations (default: 1, sequential)
- `signal` — `AbortSignal` for cancellation

## Error Types

```ts
import {
  EmptySequenceError,
  MoreThanOneElementError,
  ArgumentOutOfRangeError,
  InvalidOperationError,
} from "ogerquery";
```

| Error | When Thrown |
|-------|-------------|
| `EmptySequenceError` | `First`, `Last`, `Single`, `FirstOrThrow`, `LastOrThrow`, `SingleOrThrow`, `Min`, `Max`, `Average`, `MinBy`, `MaxBy`, `Median`, `Mode`, `Percentile`, `ElementAt`, `Reduce` (no seed) on empty |
| `MoreThanOneElementError` | `Single`, `SingleOrDefault`, `SingleOrThrow` with >1 match |
| `ArgumentOutOfRangeError` | `ElementAt` with invalid index; `Chunk`/`Buffer` with size ≤ 0 |
| `InvalidOperationError` | `Reduce` without seed on empty |
| `RangeError` | `Take`/`Skip` with negative count; `Range`/`Repeat` with negative count |

## Async Variants

All terminals have `Async` suffix returning `Promise`:

```ts
const arr = await query.ToArrayAsync();
const first = await query.FirstAsync();
const count = await query.CountAsync();
const [matches, non] = await query.PartitionAsync((x) => x.active);
const page = await query.PaginateAsync(1, 20);
const [pre, suf] = await query.SplitAtAsync(10);
await query.ForEachAsync(async (x) => await save(x), { concurrency: 10 });
```

## terminalHelpers

The helper module provides:

```ts
function iterate<T>(source: Iterable<T>, pipeline: OpPipeline<T>): Iterable<T>;
async function collectToArray<T>(source: AsyncIterable<T>, pipeline: OpPipeline<T>): Promise<T[]>;
const emptyPipeline = { ops: [] };
```

`iterate` wraps `executePipeline` into an `Iterable`. `collectToArray` collects async pipeline output into a `Promise<T[]>`. These are used by terminal implementations to avoid code duplication.
