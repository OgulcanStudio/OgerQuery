# Async Query API

`AsyncQuery<T>` mirrors the sync API for `AsyncIterable<T>` sources. All 91+ operators return `AsyncQuery` and terminals return `Promise`.

## Entry Points

```ts
import { QAsync, FromAsync, EmptyAsync } from "ogerquery";

QAsync(asyncIterable)      // From AsyncIterable<T>
FromAsync(asyncIterable)   // Readable alias
EmptyAsync<T>()            // Empty async query

// Static helpers on QAsync:
QAsync.From(source)        // same as FromAsync
QAsync.Empty<T>()          // same as EmptyAsync
QAsync.pipe(source, fn)    // same as pipeAsync
```

## AsyncQuery Class

```ts
class AsyncQuery<T> implements AsyncIterable<T> {
  constructor(source: AsyncIterable<T>, pipeline?: OpPipeline<T>);

  // Iterator protocol
  async *[Symbol.asyncIterator](): AsyncIterator<T>;

  // All 24 lazy operators — identical signatures to Query<T>
  Where(predicate: Predicate<T>): AsyncQuery<T>;
  Select<R>(selector: Selector<T, R>): AsyncQuery<R>;
  SelectMany<R>(selector: Selector<T, Iterable<R>>): AsyncQuery<R>;
  OfType<R extends T>(): AsyncQuery<R>;
  Cast<R>(): AsyncQuery<R>;
  Take(count: number): AsyncQuery<T>;
  TakeLast(count: number): AsyncQuery<T>;
  TakeWhile(predicate: Predicate<T>): AsyncQuery<T>;
  Skip(count: number): AsyncQuery<T>;
  SkipLast(count: number): AsyncQuery<T>;
  SkipWhile(predicate: Predicate<T>): AsyncQuery<T>;
  DefaultIfEmpty(defaultValue: T): AsyncQuery<T>;
  Chunk(size: number): AsyncQuery<T[]>;
  Scan<TAcc>(seed: TAcc, func: (acc: TAcc, item: T, index: number) => TAcc): AsyncQuery<TAcc>;
  WithIndex(): AsyncQuery<Indexed<T>>;
  Index(): AsyncQuery<[number, T]>;
  Buffer(size: number, step?: number): AsyncQuery<T[]>;
  TryWhere(predicate: Predicate<T>): AsyncQuery<T>;
  Pairwise(): AsyncQuery<Pair<T>>;
  Tap(action: (item: T, index: number) => void): AsyncQuery<T>;
  Flatten<U>(this: AsyncQuery<Iterable<U>>): AsyncQuery<U>;
  AdjacentDistinct(comparer?: EqualityComparer<T>): AsyncQuery<T>;
  Prepend(items: Iterable<T>): AsyncQuery<T>;
  Append(items: Iterable<T>): AsyncQuery<T>;

  // All 25 materializing operators
  OrderBy<K>(keySelector: OrderKey<T, K>, options?: OrderByOptions): AsyncQuery<T>;
  OrderByDescending<K>(keySelector: OrderKey<T, K>, options?: Omit<OrderByOptions, 'descending'>): AsyncQuery<T>;
  ThenBy<K>(keySelector: OrderKey<T, K>, options?: OrderByOptions): AsyncQuery<T>;
  ThenByDescending<K>(keySelector: OrderKey<T, K>, options?: Omit<OrderByOptions, 'descending'>): AsyncQuery<T>;
  Order(options?: OrderByOptions): AsyncQuery<T>;
  OrderDescending(options?: Omit<OrderByOptions, 'descending'>): AsyncQuery<T>;
  Reverse(): AsyncQuery<T>;
  Distinct(comparer?: EqualityComparer<T>): AsyncQuery<T>;
  DistinctBy<K>(keySelector: Selector<T, K>, comparer?: EqualityComparer<K>): AsyncQuery<T>;
  Concat(second: Iterable<T> | AsyncIterable<T>): AsyncQuery<T>;
  Union(second: Iterable<T> | AsyncIterable<T>, comparer?: EqualityComparer<T>): AsyncQuery<T>;
  Intersect(second: Iterable<T> | AsyncIterable<T>, comparer?: EqualityComparer<T>): AsyncQuery<T>;
  Except(second: Iterable<T> | AsyncIterable<T>, comparer?: EqualityComparer<T>): AsyncQuery<T>;
  UnionBy<K>(second: Iterable<T> | AsyncIterable<T>, keySelector: Selector<T, K>, comparer?: EqualityComparer<K>): AsyncQuery<T>;
  IntersectBy<K>(second: Iterable<K> | AsyncIterable<K>, keySelector: Selector<T, K>, comparer?: EqualityComparer<K>): AsyncQuery<T>;
  ExceptBy<K>(second: Iterable<K> | AsyncIterable<K>, keySelector: Selector<T, K>, comparer?: EqualityComparer<K>): AsyncQuery<T>;
  GroupBy<K>(keySelector: Selector<T, K>): AsyncQuery<IGrouping<K, T>>;
  GroupBy<K, E>(keySelector: Selector<T, K>, elementSelector: Selector<T, E>): AsyncQuery<IGrouping<K, E>>;
  Join<TInner, TKey, TResult>(inner: Iterable<TInner> | AsyncIterable<TInner>, ...): AsyncQuery<TResult>;
  GroupJoin<TInner, TKey, TResult>(inner: Iterable<TInner> | AsyncIterable<TInner>, ...): AsyncQuery<TResult>;
  LeftJoin<TInner, TKey, TResult>(...): AsyncQuery<TResult>;
  RightJoin<TInner, TKey, TResult>(...): AsyncQuery<TResult>;
  FullJoin<TInner, TKey, TResult>(...): AsyncQuery<TResult>;
  Zip<TSecond, TResult>(second: Iterable<TSecond> | AsyncIterable<TSecond>, ...): AsyncQuery<TResult>;
  AggregateBy<K, A>(...): AsyncQuery<[K, A]>;

  // Predicate DSL — all Where* helpers
  WhereEq, WhereNotEq, WhereGt, WhereGte, WhereLt, WhereLte,
  WhereIn, WhereNotIn, WhereBetween,
  WhereContains, WhereStartsWith, WhereEndsWith,
  WhereNull, WhereNotNull, WhereTruthy, WhereFalsy,
  Pluck, SelectKeys, OmitKeys;

  // Utilities
  Page(page, pageSize): AsyncQuery<T>;
  GroupByMany(...keySelectors): AsyncQuery<IGrouping<unknown[], T>>;
  Explain();
  ExplainText();
}
```

## Async Terminals

All 42 sync terminals have `Async` suffix variants returning `Promise`:

```ts
// Collection
const arr = await query.ToArrayAsync();
const list = await query.ToListAsync();
const set = await query.ToSetAsync();
const map = await query.ToMapAsync((u) => u.id, (u) => u.name);
const obj = await query.ToObjectAsync(keySel, elementSel);
const dict = await query.ToDictionaryAsync(keySel, elementSel);
const lookup = await query.ToLookupAsync(keySel, elementSel);

// Single element
const first = await query.FirstAsync();
const firstDef = await query.FirstOrDefaultAsync(null);
const firstThrow = await query.FirstOrThrowAsync();
const last = await query.LastAsync();
const lastDef = await query.LastOrDefaultAsync(null);
const lastThrow = await query.LastOrThrowAsync();
const single = await query.SingleAsync();
const singleDef = await query.SingleOrDefaultAsync(null);
const singleThrow = await query.SingleOrThrowAsync();
const elem = await query.ElementAtAsync(0);
const elemDef = await query.ElementAtOrDefaultAsync(0, null);

// Aggregation
const count = await query.CountAsync();
const longCount = await query.LongCountAsync();
const countBy = await query.CountByAsync((u) => u.role);
const sum = await query.SumAsync((u) => u.salary);
const avg = await query.AverageAsync((u) => u.age);
const min = await query.MinAsync((u) => u.age);
const max = await query.MaxAsync((u) => u.salary);
const minBy = await query.MinByAsync((u) => u.age);
const maxBy = await query.MaxByAsync((u) => u.salary);
const median = await query.MedianAsync();
const mode = await query.ModeAsync((u) => u.role);
const p95 = await query.PercentileAsync(95, (u) => u.latency);
const agg = await query.AggregateAsync(0, (acc, u) => acc + u.salary);
const reduced = await query.ReduceAsync((a, b) => a + b);

// Quantifiers
const any = await query.AnyAsync();
const all = await query.AllAsync((u) => u.active);
const contains = await query.ContainsAsync("value");
const equal = await query.SequenceEqualAsync(other);

// Conversion
const [matches, non] = await query.PartitionAsync((u) => u.active);
const [pre, suf] = await query.SplitAtAsync(10);

// Pagination
const page = await query.PaginateAsync(1, 20, 100);
const cursorPage = await query.CursorPageAsync(20, "cursor123");

// Iteration
await query.ForEachAsync(
  async (item) => await process(item),
  { concurrency: 5, signal: abortController.signal }
);
```

## AbortSignal Support

Async terminals accept `AbortSignal` through their options parameter (where applicable) or throw `AbortError` when the signal fires:

```ts
const controller = new AbortController();

// ForEachAsync with concurrency + signal
await query.ForEachAsync(
  async (item) => await process(item),
  { concurrency: 5, signal: controller.signal }
);

// Internal: executeAsyncPipeline checks signal at each yield
async function* executeAsyncPipeline(source, pipeline, signal) {
  throwIfAborted(signal);  // Check before starting
  for await (const item of source) {
    throwIfAborted(signal); // Check on each item
    yield item;
  }
}
```

## Early Termination

Terminals like `FirstAsync`, `AnyAsync`, `CountAsync` stop pulling the async source once satisfied:

```ts
const first = await QAsync(largeAsyncGenerator())
  .Where((x) => x.valid)
  .FirstAsync(); // Stops after first match

const hasAny = await QAsync(largeAsyncSource())
  .AnyAsync(); // Stops after first element
```

## Concurrency Control

`ForEachAsync` supports configurable concurrency:

```ts
// Sequential (default concurrency=1)
await query.ForEachAsync(async (x) => await save(x));

// Parallel with limit
await query.ForEachAsync(
  async (item) => await process(item),
  { concurrency: 10 }
);

// With cancellation
await query.ForEachAsync(
  async (item) => await process(item),
  { concurrency: 5, signal: abortController.signal }
);
```

With concurrency > 1, the pipeline materializes first via `collectToArray`, then processes items in parallel worker pool.

## Mixing Sync Ops in Async Pipelines

All sync lazy and materializing operators work in async pipelines because they return `AsyncQuery<T>` with identical signatures. The pipeline only stores operation descriptors; execution differs:

- **Lazy sync ops** in async context → `applyAsyncLazyBatch` buffers to array, runs sync executor, converts back to async
- **Materializing sync ops** in async context → `resolveMaterializingOpSecond` resolves async inner iterables, `collectToArray` buffers upstream, runs sync materializer

## Async Sources

Works with any `AsyncIterable<T>`:

```ts
// Async generator
async function* fetchPages() {
  for await (const page of api.paginate()) {
    yield* page.items;
  }
}
const items = await FromAsync(fetchPages()).ToArrayAsync();

// ReadableStream (via adapter)
import { fromReadableStream } from "ogerquery";
const items = await FromAsync(fromReadableStream(response.body!))
  .Where((x) => x.valid)
  .ToArrayAsync();

// Database cursor (if AsyncIterable)
const users = await FromAsync(db.users.findCursor()).ToArrayAsync();
```

## Error Handling

Errors in async iteration propagate through the pipeline:

```ts
try {
  await query.ToArrayAsync();
} catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError') {
    // Cancelled via AbortSignal
  }
  // Handle source or operator errors
}
```

Use `TryWhere` to skip elements whose predicate throws:

```ts
QAsync(riskySource)
  .TryWhere((x) => validate(x)) // Predicate errors skipped
  .ToArrayAsync();
```

## Pipeline Composition

```ts
import { pipeAsync } from "ogerquery";

const result = await pipeAsync(source, async (q) =>
  q.Where((x) => x.active)
   .Select((x) => x.name)
   .ToArrayAsync()
);
```

## Async Pipeline Execution Model

```
AsyncSource → collectToArray → sync executor (lazy batch) → collectToArray → sync materializer → async iterable → ... → Promise<T[]>
```

1. Lazy batches: buffer async → array, apply sync executor
2. Materializing ops: resolve async inner, buffer async → array, apply sync materializer
3. Terminal: buffer async → array, apply sync terminal
