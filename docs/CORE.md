# Core Architecture

## Types (`src/core/types.ts`)

```ts
type Predicate<T> = (item: T, index?: number) => boolean;
type Selector<T, R> = (item: T, index?: number) => R;
type Comparer<T> = (a: T, b: T) => number;
type EqualityComparer<T> = (a: T, b: T) => boolean;
type OrderKey<T, K> = (item: T, index?: number) => K;
```

### Data types

```ts
type Indexed<T> = { readonly value: T; readonly index: number };
type Pair<T> = readonly [previous: T, current: T];
```

### Grouping & Lookup

```ts
interface IGrouping<K, T> {
  readonly key: K;
  [Symbol.iterator](): Iterator<T>;
}

class Grouping<K, T> implements IGrouping<K, T> {
  constructor(key: K, elements: T[]);
  toArray(): T[];
}

class Lookup<K, T> implements Iterable<IGrouping<K, T>> {
  constructor(entries: Iterable<[K, T[]]>);
  get(key: K): IGrouping<K, T>;
  contains(key: K): boolean;
  count(): number;
}
```

### Error types

| Class | Default message |
|-------|----------------|
| `EmptySequenceError` | "Sequence contains no elements" |
| `MoreThanOneElementError` | "Sequence contains more than one element" |
| `ArgumentOutOfRangeError` | "Index was out of range" |
| `InvalidOperationError` | Custom message |

## Q Class (`src/core/Q.ts`)

Entry point functions:

```ts
function Q<T>(source: QuerySource<T>): Query<T>;
function From<T>(source: QuerySource<T>): Query<T>;
function Empty<T>(): Query<T>;
function Range(start: number, count: number): Query<number>;
function Repeat<T>(element: T, count: number): Query<T>;
function pipe<T, R>(source: Iterable<T>, transform: (query: Query<T>) => R): R;

function QAsync<T>(source: AsyncQuerySource<T>): AsyncQuery<T>;
function FromAsync<T>(source: AsyncQuerySource<T>): AsyncQuery<T>;
function EmptyAsync<T>(): AsyncQuery<T>;
function pipeAsync<T, R>(source: AsyncQuerySource<T>, transform: (query: AsyncQuery<T>) => R): Promise<R>;
```

Static helpers:

```ts
Q.Empty = Empty;
Q.From = From;
Q.Range = Range;
Q.Repeat = Repeat;
Q.pipe = pipe;

QAsync.From = FromAsync;
QAsync.Empty = EmptyAsync;
QAsync.pipe = pipeAsync;
```

### Type aliases

```ts
type QuerySource<T> = Iterable<T> | readonly T[];
type AsyncQuerySource<T> = AsyncIterable<T>;
```

## Query Class (`src/core/Query.ts`)

The sync query class implements `Iterable<T>` and provides the fluent API:

```ts
class Query<T> implements Iterable<T> {
  constructor(source: Iterable<T>, pipeline?: OpPipeline<T>);

  // Iterable protocol — triggers execution
  [Symbol.iterator](): Iterator<T>;

  // Lazy operators (24)
  Where(predicate: Predicate<T>): Query<T>;
  Select<R>(selector: Selector<T, R>): Query<R>;
  SelectMany<R>(selector: Selector<T, Iterable<R>>): Query<R>;
  OfType<R extends T>(): Query<R>;
  Cast<R>(): Query<R>;
  Take(count: number): Query<T>;
  TakeLast(count: number): Query<T>;
  TakeWhile(predicate: Predicate<T>): Query<T>;
  Skip(count: number): Query<T>;
  SkipLast(count: number): Query<T>;
  SkipWhile(predicate: Predicate<T>): Query<T>;
  DefaultIfEmpty(defaultValue: T): Query<T>;
  Chunk(size: number): Query<T[]>;
  Scan<TAcc>(seed: TAcc, func: (acc: TAcc, item: T, index: number) => TAcc): Query<TAcc>;
  WithIndex(): Query<Indexed<T>>;
  Buffer(size: number, step?: number): Query<T[]>;
  TryWhere(predicate: Predicate<T>): Query<T>;
  Pairwise(): Query<Pair<T>>;
  Tap(action: (item: T, index: number) => void): Query<T>;
  Flatten<U>(this: Query<Iterable<U>>): Query<U>;
  AdjacentDistinct(comparer?: EqualityComparer<T>): Query<T>;
  Prepend(items: Iterable<T>): Query<T>;
  Append(items: Iterable<T>): Query<T>;
  Index(): Query<[number, T]>;

  // Materializing operators (25)
  OrderBy<K>(keySelector: OrderKey<T, K>, options?: OrderByOptions): Query<T>;
  OrderByDescending<K>(keySelector: OrderKey<T, K>, options?: Omit<OrderByOptions, 'descending'>): Query<T>;
  ThenBy<K>(keySelector: OrderKey<T, K>, options?: OrderByOptions): Query<T>;
  ThenByDescending<K>(keySelector: OrderKey<T, K>, options?: Omit<OrderByOptions, 'descending'>): Query<T>;
  Order(options?: OrderByOptions): Query<T>;
  OrderDescending(options?: Omit<OrderByOptions, 'descending'>): Query<T>;
  Reverse(): Query<T>;
  Distinct(comparer?: EqualityComparer<T>): Query<T>;
  DistinctBy<K>(keySelector: Selector<T, K>, comparer?: EqualityComparer<K>): Query<T>;
  Concat(second: Iterable<T>): Query<T>;
  Union(second: Iterable<T>, comparer?: EqualityComparer<T>): Query<T>;
  Intersect(second: Iterable<T>, comparer?: EqualityComparer<T>): Query<T>;
  Except(second: Iterable<T>, comparer?: EqualityComparer<T>): Query<T>;
  UnionBy<K>(second: Iterable<T>, keySelector: Selector<T, K>, comparer?: EqualityComparer<K>): Query<T>;
  IntersectBy<K>(second: Iterable<K>, keySelector: Selector<T, K>, comparer?: EqualityComparer<K>): Query<T>;
  ExceptBy<K>(second: Iterable<K>, keySelector: Selector<T, K>, comparer?: EqualityComparer<K>): Query<T>;
  GroupBy<K>(keySelector: Selector<T, K>): Query<IGrouping<K, T>>;
  GroupBy<K, E>(keySelector: Selector<T, K>, elementSelector: Selector<T, E>): Query<IGrouping<K, E>>;
  Join<TInner, TKey, TResult>(inner: Iterable<TInner>, outerKeySelector: Selector<T, TKey>, innerKeySelector: Selector<TInner, TKey>, resultSelector: (outer: T, inner: TInner) => TResult, comparer?: EqualityComparer<TKey>): Query<TResult>;
  GroupJoin<TInner, TKey, TResult>(inner: Iterable<TInner>, outerKeySelector: Selector<T, TKey>, innerKeySelector: Selector<TInner, TKey>, resultSelector: (outer: T, inner: Iterable<TInner>) => TResult, comparer?: EqualityComparer<TKey>): Query<TResult>;
  LeftJoin<TInner, TKey, TResult>(...): Query<TResult>;
  RightJoin<TInner, TKey, TResult>(...): Query<TResult>;
  FullJoin<TInner, TKey, TResult>(...): Query<TResult>;
  Zip<TSecond, TResult>(second: Iterable<TSecond>, resultSelector: (first: T, second: TSecond) => TResult): Query<TResult>;
  AggregateBy<K, A>(keySelector: Selector<T, K>, seed: A | ((item: T) => A), func: (acc: A, item: T) => A, comparer?: EqualityComparer<K>): Query<[K, A]>;

  // Terminal operators (42)
  ToArray(): T[];
  ToList(): T[];
  ToSet(): Set<T>;
  ToMap<K, V>(keySelector: Selector<T, K>, elementSelector?: Selector<T, V>): Map<K, V>;
  ToDictionary<K, V>(keySelector: Selector<T, K>, elementSelector?: Selector<T, V>): Map<K, V>;
  ToObject<K extends string, V>(keySelector: Selector<T, K>, elementSelector?: Selector<T, V>): Record<K, V>;
  ToLookup<K, V>(keySelector: Selector<T, K>, elementSelector?: Selector<T, V>): Lookup<K, V>;
  First(predicate?: Predicate<T>): T;
  FirstOrDefault(defaultValue: T, predicate?: Predicate<T>): T;
  FirstOrThrow(predicate?: Predicate<T>): T;
  Last(predicate?: Predicate<T>): T;
  LastOrDefault(defaultValue: T, predicate?: Predicate<T>): T;
  LastOrThrow(predicate?: Predicate<T>): T;
  Single(predicate?: Predicate<T>): T;
  SingleOrDefault(defaultValue: T, predicate?: Predicate<T>): T;
  SingleOrThrow(predicate?: Predicate<T>): T;
  ElementAt(index: number): T;
  ElementAtOrDefault(index: number, defaultValue: T): T;
  Count(predicate?: Predicate<T>): number;
  LongCount(): number;
  CountBy<K>(keySelector: Selector<T, K>): Map<K, number>;
  Sum(selector?: Selector<T, number>): number;
  Average(selector?: Selector<T, number>): number;
  Min(selector?: Selector<T, number>): number;
  Max(selector?: Selector<T, number>): number;
  MinBy<K>(keySelector: Selector<T, K>): T;
  MaxBy<K>(keySelector: Selector<T, K>): T;
  Median(selector?: Selector<T, number>): number;
  Mode<TKey>(keySelector?: Selector<T, TKey>): TKey | T;
  Percentile(percentile: number, selector?: Selector<T, number>): number;
  Aggregate<TAcc>(seed: TAcc, func: (acc: TAcc, item: T, index: number) => TAcc): TAcc;
  Reduce(func: (acc: T, item: T, index: number) => T): T;
  Reduce<TAcc>(seed: TAcc, func: (acc: TAcc, item: T, index: number) => TAcc): TAcc;
  All(predicate: Predicate<T>): boolean;
  Any(predicate?: Predicate<T>): boolean;
  Contains(value: T, comparer?: EqualityComparer<T>): boolean;
  SequenceEqual(second: Iterable<T>, comparer?: EqualityComparer<T>): boolean;
  ForEach(action: (item: T, index: number) => void): void;
  Partition(predicate: Predicate<T>): [T[], T[]];
  SplitAt(index: number): [T[], T[]];
  Paginate(page: number, pageSize: number, maxPageSize?: number): PageResult<T>;
  CursorPage(pageSize: number, cursor?: string, maxPageSize?: number): CursorPageResult<T>;

  // Predicate DSL helpers
  WhereEq(path: PathOrKey<T>, value: unknown): Query<T>;
  WhereNotEq(...): Query<T>;
  WhereGt(...): Query<T>;
  WhereGte(...): Query<T>;
  WhereLt(...): Query<T>;
  WhereLte(...): Query<T>;
  WhereIn(...): Query<T>;
  WhereNotIn(...): Query<T>;
  WhereBetween(...): Query<T>;
  WhereContains(...): Query<T>;
  WhereStartsWith(...): Query<T>;
  WhereEndsWith(...): Query<T>;
  WhereNull(...): Query<T>;
  WhereNotNull(...): Query<T>;
  WhereTruthy(...): Query<T>;
  WhereFalsy(...): Query<T>;

  // Utilities
  Page(page: number, pageSize: number): Query<T>;
  GroupByMany(...keySelectors: Selector<T, unknown>[]): Query<IGrouping<unknown[], T>>;
  Pluck<K extends PathOrKey<T>>(path: K): Query<unknown>;
  SelectKeys<K extends keyof T>(this: Query<T & object>, ...keys: K[]): Query<Pick<T, K>>;
  OmitKeys<K extends keyof T>(this: Query<T & object>, ...keys: K[]): Query<Omit<T, K>>;
  Explain(): ReturnType<typeof explainPipeline>;
  ExplainText(): string[];
}
```

## OpPipeline (`src/core/OpPipeline.ts`)

```ts
class OpPipeline<T> {
  readonly ops: PipelineOp<T>[];
  constructor(ops?: PipelineOp<T>[]);
  append(op: PipelineOp<T>): OpPipeline<T>;
  replaceLast(op: PipelineOp<T>): OpPipeline<T>;
  get last(): PipelineOp<T> | undefined;
  isEmpty(): boolean;
}
```

- `append` — creates new pipeline with op appended (immutable)
- `replaceLast` — replaces the last op (used during fusion)
- `last` — peek at the most recent op (for fusion decisions)

## FeaturePlugin Interface (`src/core/FeaturePlugin.ts`)

```ts
type FeatureCategory = 'lazy' | 'materializing' | 'terminal';

interface FeaturePlugin {
  name: string;          // Method name, e.g. 'Where'
  kind?: string;         // Op kind, e.g. 'where' (lazy/materializing only)
  category: FeatureCategory;

  // Lazy/materializing ops
  append?: (pipeline: OpPipeline<any>, ...args: any[]) => OpPipeline<any>;
  executeSync?: (source: Iterable<any>, op: any) => Iterable<any>;

  // Terminal ops
  runSync?: (source: Iterable<any>, pipeline: OpPipeline<any>, ...args: any[]) => any;
  runAsync?: (source: AsyncIterable<any>, pipeline: OpPipeline<any>, ...args: any[]) => Promise<any>;

  testCases: FeatureTestCase[];
}
```

The `append` function implements fusion rules by inspecting `pipeline.last`. For example:

- `Where` + `Where` → merges predicates with `&&`
- `Select` + `Select` → composes selectors right-to-left
- `Take` + `Take` → uses `Math.min`
- `Skip` + `Skip` → sums counts

### FeatureRegistry

```ts
const FeatureRegistry = new Map<string, FeaturePlugin>();

function registerFeature(feature: FeaturePlugin): void;
```

Ops are registered by both `kind` (for pipeline execution lookup) and `name` (for dynamic method lookup). All 91+ features are registered in `src/features/registry.ts`.

## PipelineOp Discriminated Union (`src/core/pipelineOps.ts`)

48+ operation kinds:

```ts
type PipelineOp<T> =
  // Lazy fusible
  | { kind: 'where'; predicate: Predicate<T> }
  | { kind: 'select'; selector: Selector<T, unknown> }
  | { kind: 'take'; count: number }
  | { kind: 'skip'; count: number }

  // Lazy non-fusible
  | { kind: 'selectMany'; selector: Selector<T, Iterable<unknown>> }
  | { kind: 'ofType' }
  | { kind: 'cast' }
  | { kind: 'takeWhile'; predicate: Predicate<T> }
  | { kind: 'skipWhile'; predicate: Predicate<T> }
  | { kind: 'chunk'; size: number }
  | { kind: 'scan'; seed: unknown; func: ... }
  | { kind: 'withIndex' }
  | { kind: 'buffer'; size: number; step: number }
  | { kind: 'tryWhere'; predicate: Predicate<T> }
  | { kind: 'pairwise' }
  | { kind: 'tap'; action: ... }
  | { kind: 'flatten' }
  | { kind: 'adjacentDistinct'; comparer?: EqualityComparer<T> }
  | { kind: 'prepend'; items: Iterable<T> }
  | { kind: 'append'; items: Iterable<T> }
  | { kind: 'defaultIfEmpty'; defaultValue: T }
  | { kind: 'index' }
  | { kind: 'takeLast'; count: number }
  | { kind: 'skipLast'; count: number }

  // Materializing
  | { kind: 'orderBy'; keys: OrderKeyEntry<T>[] }
  | { kind: 'reverse' }
  | { kind: 'distinct'; comparer?: EqualityComparer<T> }
  | { kind: 'distinctBy'; keySelector: ...; comparer?: ... }
  | { kind: 'groupBy'; keySelector: ...; elementSelector?: ... }
  | { kind: 'join'; inner: ...; outerKeySelector: ...; innerKeySelector: ...; resultSelector: ...; comparer?: ... }
  | { kind: 'groupJoin'; ... }
  | { kind: 'leftJoin'; ... }
  | { kind: 'rightJoin'; ... }
  | { kind: 'fullJoin'; ... }
  | { kind: 'zip'; second: ...; resultSelector: ... }
  | { kind: 'concat'; second: ... }
  | { kind: 'union'; second: ...; comparer?: ... }
  | { kind: 'intersect'; second: ...; comparer?: ... }
  | { kind: 'except'; second: ...; comparer?: ... }
  | { kind: 'aggregateBy'; keySelector: ...; seed: ...; func: ...; comparer?: ... }
  | { kind: 'unionBy'; second: ...; keySelector: ...; comparer?: ... }
  | { kind: 'intersectBy'; second: ...; keySelector: ...; comparer?: ... }
  | { kind: 'exceptBy'; second: ...; keySelector: ...; comparer?: ... };
```

### Helper functions

```ts
function isMaterializingOp<T>(op: PipelineOp<T>): boolean;
function isLazyFusableOp<T>(op: PipelineOp<T>): boolean;
function canUseArrayFastPath<T>(ops: PipelineOp<T>[]): boolean;
```

## Executor (`src/core/executor.ts`)

### `executePipeline`

```ts
function* executePipeline<T>(source: Iterable<T>, pipeline: OpPipeline<T>): Generator<T>
```

Execution logic:
1. If no ops → yield* source directly
2. If source is array + fusible only → use `arrayFastPath` (index-based loops)
3. Otherwise → use `runSegmented`

### `runSegmented`

Segments ops into lazy batches, executes each segment via `wrapLazy`, and flushes at materializing boundaries via `materialize`.

### `arrayFastPath`

Specialized for 1, 2, and 3-op combinations:
- 1 op:`where`, `select`, `take`, or `skip`
- 2 ops:`where+select`, `where+take`, `select+take`
- 3 ops:`where+select+take`, `where+skip+take`
- Fallback: multi-op step-based loop for >3 fusible ops

## AsyncExecutor (`src/core/asyncExecutor.ts`)

### `executeAsyncPipeline`

```ts
async function* executeAsyncPipeline<T>(
  source: AsyncIterable<T>,
  pipeline: OpPipeline<T>,
  signal?: AbortSignal
): AsyncGenerator<T>
```

Key differences from sync:
- Uses `for await` loops with `AbortSignal` checks (`throwIfAborted`)
- Materializing ops buffer to array via `collectToArray` before processing
- `resolveMaterializingOpSecond` handles async materializing op resolution
- Lazy batches apply by collecting to array, running sync executor, converting back to async
