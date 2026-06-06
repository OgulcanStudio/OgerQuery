# Query API (Sync)

Complete reference for `Query<T>` operators. All operators are lazy unless marked **Terminal**.

## `Q()` Static Methods

```ts
import { Q, QAsync, Empty, Range, Repeat, From, FromAsync, pipe, pipeAsync } from "ogerquery";

Q(source)                    // Create Query<T> from Iterable<T>
Q.Empty()                    // Empty query
Q.Range(start, count)        // Range of numbers [start, start+count)
Q.Repeat(element, count)     // Repeat element N times
Q.From(source)               // Readable alias for Q(source)
Q.pipe(source, transform)    // Pipe into transform function

// Async variants
QAsync(source)               // Create AsyncQuery<T>
QAsync.Empty()               // Empty async query
QAsync.From(source)          // Readable alias
QAsync.pipe(source, fn)      // Async pipe
pipe(source, fn)             // Sync static pipe
pipeAsync(source, fn)        // Async static pipe
```

## Projection

| Operator | Signature |
|----------|-----------|
| `Select` | `Select<R>(selector: Selector<T, R>): Query<R>` |
| `SelectMany` | `SelectMany<R>(selector: Selector<T, Iterable<R>>): Query<R>` |
| `Pluck` | `Pluck(path): Query<unknown>` |
| `SelectKeys` | `SelectKeys(...keys): Query<Pick<T, K>>` |
| `OmitKeys` | `OmitKeys(...keys): Query<Omit<T, K>>` |

## Filtering

| Operator | Signature |
|----------|-----------|
| `Where` | `Where(predicate): Query<T>` |
| `WhereEq` | `WhereEq(path, value): Query<T>` |
| `WhereNotEq` | `WhereNotEq(path, value): Query<T>` |
| `WhereGt` | `WhereGt(path, value): Query<T>` |
| `WhereGte` | `WhereGte(path, value): Query<T>` |
| `WhereLt` | `WhereLt(path, value): Query<T>` |
| `WhereLte` | `WhereLte(path, value): Query<T>` |
| `WhereIn` | `WhereIn(path, values[]): Query<T>` |
| `WhereNotIn` | `WhereNotIn(path, values[]): Query<T>` |
| `WhereBetween` | `WhereBetween(path, min, max): Query<T>` |
| `WhereContains` | `WhereContains(path, substr, insensitive?): Query<T>` |
| `WhereStartsWith` | `WhereStartsWith(path, prefix, insensitive?): Query<T>` |
| `WhereEndsWith` | `WhereEndsWith(path, suffix, insensitive?): Query<T>` |
| `WhereNull` | `WhereNull(path): Query<T>` |
| `WhereNotNull` | `WhereNotNull(path): Query<T>` |
| `WhereTruthy` | `WhereTruthy(path): Query<T>` |
| `WhereFalsy` | `WhereFalsy(path): Query<T>` |
| `OfType` | `OfType<R extends T>(): Query<R>` |
| `Cast` | `Cast<R>(): Query<R>` |
| `TryWhere` | `TryWhere(predicate): Query<T>` |

## Partitioning

| Operator | Signature |
|----------|-----------|
| `Take` | `Take(count): Query<T>` |
| `Skip` | `Skip(count): Query<T>` |
| `TakeWhile` | `TakeWhile(predicate): Query<T>` |
| `SkipWhile` | `SkipWhile(predicate): Query<T>` |
| `TakeLast` | `TakeLast(count): Query<T>` |
| `SkipLast` | `SkipLast(count): Query<T>` |
| `Page` | `Page(page, pageSize): Query<T>` |

## Ordering

| Operator | Signature |
|----------|-----------|
| `OrderBy` | `OrderBy(keySelector, options?): Query<T>` |
| `OrderByDescending` | `OrderByDescending(keySelector, options?): Query<T>` |
| `ThenBy` | `ThenBy(keySelector, options?): Query<T>` |
| `ThenByDescending` | `ThenByDescending(keySelector, options?): Query<T>` |
| `Order` | `Order(options?): Query<T>` |
| `OrderDescending` | `OrderDescending(options?): Query<T>` |
| `Reverse` | `Reverse(): Query<T>` |

**OrderByOptions:**
```ts
interface OrderByOptions {
  descending?: boolean;
  comparer?: Comparer<unknown>;
  nulls?: "first" | "last";
  localeCompare?: boolean | string;
}
```

## Grouping

| Operator | Signature |
|----------|-----------|
| `GroupBy` | `GroupBy(keySelector): Query<IGrouping<K, T>>` |
| `GroupBy` | `GroupBy(keySelector, elementSelector): Query<IGrouping<K, E>>` |
| `GroupByMany` | `GroupByMany(...keySelectors): Query<IGrouping<unknown[], T>>` |
| `Distinct` | `Distinct(comparer?): Query<T>` |
| `DistinctBy` | `DistinctBy(keySelector, comparer?): Query<T>` |

## Joins (Materializing)

| Operator | Signature |
|----------|-----------|
| `Join` | `Join(inner, outerKey, innerKey, result, comparer?)` |
| `GroupJoin` | `GroupJoin(inner, outerKey, innerKey, result, comparer?)` |
| `LeftJoin` | `LeftJoin(inner, outerKey, innerKey, result, comparer?)` |
| `RightJoin` | `RightJoin(inner, outerKey, innerKey, result, comparer?)` |
| `FullJoin` | `FullJoin(inner, outerKey, innerKey, result, comparer?)` |
| `Zip` | `Zip(second, resultSelector)` |

## Set Operations

| Operator | Signature |
|----------|-----------|
| `Concat` | `Concat(second): Query<T>` |
| `Union` | `Union(second, comparer?): Query<T>` |
| `Intersect` | `Intersect(second, comparer?): Query<T>` |
| `Except` | `Except(second, comparer?): Query<T>` |
| `UnionBy` | `UnionBy(second, keySelector, comparer?): Query<T>` |
| `IntersectBy` | `IntersectBy(second, keySelector, comparer?): Query<T>` |
| `ExceptBy` | `ExceptBy(second, keySelector, comparer?): Query<T>` |

## Unique Lazy Operators

| Operator | Signature | Description |
|----------|-----------|-------------|
| `WithIndex` | `WithIndex(): Query<Indexed<T>>` | Yields `{ value, index }` |
| `Index` | `Index(): Query<[number, T]>` | Yields `[index, value]` |
| `Buffer` | `Buffer(size, step?): Query<T[]>` | Sliding windows |
| `Pairwise` | `Pairwise(): Query<Pair<T>>` | Adjacent pairs |
| `Tap` | `Tap(action): Query<T>` | Side effect (yields item) |
| `Flatten` | `Flatten(): Query<U>` | One-level flatten |
| `AdjacentDistinct` | `AdjacentDistinct(comparer?): Query<T>` | Drop consecutive duplicates |
| `Prepend` | `Prepend(items): Query<T>` | Yield items first |
| `Append` | `Append(items): Query<T>` | Yield items last |
| `Scan` | `Scan(seed, func): Query<TAcc>` | Running accumulation |
| `Chunk` | `Chunk(size): Query<T[]>` | Groups of N |
| `DefaultIfEmpty` | `DefaultIfEmpty(defaultValue): Query<T>` | Default if empty |

## AggregateBy

```ts
AggregateBy<K, A>(
  keySelector: Selector<T, K>,
  seed: A | ((item: T) => A),
  func: (acc: A, item: T) => A,
  comparer?: EqualityComparer<K>
): Query<[K, A]>
```

## Terminal: Element Operators

| Operator | Empty | Multiple |
|----------|-------|----------|
| `First(p?)` | Throw | First |
| `FirstOrDefault(d, p?)` | `d` | First |
| `Last(p?)` | Throw | Last |
| `LastOrDefault(d, p?)` | `d` | Last |
| `Single(p?)` | Throw | Throw if >1 |
| `SingleOrDefault(d, p?)` | `d` | Throw if >1 |
| `ElementAt(k)` | Throw | — |
| `ElementAtOrDefault(k, d)` | `d` | — |
| `FirstOrThrow(p?)` | Throw | First |
| `LastOrThrow(p?)` | Throw | Last |
| `SingleOrThrow(p?)` | Throw | Throw if >1 |

## Terminal: Quantifiers

| Operator | Signature |
|----------|-----------|
| `Any` | `Any(predicate?): boolean` |
| `All` | `All(predicate): boolean` |
| `Contains` | `Contains(value, comparer?): boolean` |
| `SequenceEqual` | `SequenceEqual(second, comparer?): boolean` |

## Terminal: Aggregation

| Operator | Empty Behavior |
|----------|----------------|
| `Count(p?)` | 0 |
| `LongCount()` | 0 |
| `Sum(selector?)` | 0 |
| `Min(selector?)` | Throw |
| `Max(selector?)` | Throw |
| `Average(selector?)` | Throw |
| `Aggregate(seed, func)` | Returns seed |
| `Reduce(func)` / `Reduce(seed, func)` | Throw / seed |
| `MinBy(keySelector)` | Throw |
| `MaxBy(keySelector)` | Throw |
| `Median(selector?)` | Throw |
| `Mode(keySelector?)` | Throw |
| `Percentile(p, selector?)` | Throw |
| `CountBy(keySelector)` | Empty Map |

## Terminal: Conversion

| Operator | Returns |
|----------|---------|
| `ToArray()` | `T[]` |
| `ToList()` | `T[]` |
| `ToSet()` | `Set<T>` |
| `ToMap(key, element?)` | `Map<TKey, TElement>` |
| `ToDictionary(key, element?)` | `Map<TKey, TElement>` |
| `ToObject(key, element?)` | `Record<TKey, TElement>` |
| `ToLookup(key, element?)` | `Lookup<TKey, TElement>` |
| `ForEach(action)` | `void` |

## Terminal: Partitioning

| Operator | Returns |
|----------|---------|
| `Partition(predicate)` | `[T[], T[]]` |
| `SplitAt(index)` | `[T[], T[]]` |

## Terminal: Pagination

| Operator | Returns |
|----------|---------|
| `Paginate(page, pageSize, max?)` | `PageResult<T>` |
| `CursorPage(pageSize, cursor?, max?)` | `CursorPageResult<T>` |

## Debugging

```ts
query.Explain()       // ExplainStep[] — pipeline steps as objects
query.ExplainText()   // string[] — human-readable steps
```

See [EXPLAIN.md](./EXPLAIN.md) for detailed debugging documentation.

## TypeScript Generics and Type Inference

```ts
// Type is inferred from source
const query = Q([1, 2, 3]);           // Query<number>
const mapped = query.Select(n => n.toString()); // Query<string>

// Manual type assertion
const typed = Q(source as User[]);     // Query<User>
const cast = Q(mixed).Cast<User>();    // Query<User> (runtime no-op)
```

## Pipeline Composition

```ts
import { pipe } from "ogerquery";

const result = pipe(source, (q) =>
  q.Where((x) => x.active).Select((x) => x.name).ToArray()
);
```

## See Also

- [SEMANTICS.md](./SEMANTICS.md) — lazy evaluation, fusion, laws
- [API.md](./API.md) — query string parsing
- [FILTERING.md](./FILTERING.md) — filter DSL
- [ERRORS.md](./ERRORS.md) — error handling
- [EXPLAIN.md](./EXPLAIN.md) — pipeline debugging
