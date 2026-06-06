# OgerQuery Semantics

Formal behavior for finite sequences unless noted. Let `⟦q⟧` denote the finite list produced by terminal `ToArray()` on query `q` over source sequence `S = [s₀, …, sₙ₋₁]` (left-to-right iteration order).

Indices in predicates/selectors are **0-based** and match the position in the **current** pipeline output, not the original source.

## Core Model

- **Lazy operators** append to an internal `OpPipeline` without iterating. No work is performed until a terminal is called.
- **Deferred execution**: iteration starts at the first terminal call (or `for…of` / `for await…of`).
- **Fusion**: adjacent `Where` / `Select` / `Take` / `Skip` ops collapse before execution for optimized iteration.
- **Materializing operators** flush the lazy segment to memory, apply the op, then continue streaming:
  - `OrderBy` (+ `ThenBy*`), `Reverse`, `GroupBy`, `Distinct`, `DistinctBy`, `Join`, `GroupJoin`, `LeftJoin`, `RightJoin`, `FullJoin`, `Zip`, `Concat`, `Union`, `Intersect`, `Except`, `UnionBy`, `IntersectBy`, `ExceptBy`, `AggregateBy`
- **Lazy non-fusible operators** (streaming, not buffered):
  `Chunk`, `Scan`, `WithIndex`, `Buffer`, `TryWhere`, `Pairwise`, `Tap`, `Flatten`, `AdjacentDistinct`, `Prepend`, `Append`, `Index`, `TakeLast`, `SkipLast`, `DefaultIfEmpty`

### Array Fast Path

When source is `T[]` and pipeline contains only fusible lazy ops (`Where`, `Select`, `Take`, `Skip`), execution uses index-based loops instead of iterator overhead. **Observational equivalence** with iterator execution is guaranteed (same elements, same order).

## Functor: `Select`

```
⟦Q(S).Select(f)⟧ = [f(sᵢ, i) for each sᵢ in S in order]
```

**Laws** (verified via property-based tests in `tests/properties/select-laws.test.ts`):

1. **Identity**: `Select((x) => x)` ≡ `id` (no-op)
2. **Composition**: `Select(f).Select(g)` ≡ `Select((x, i) => g(f(x, i), i))`

## Filter: `Where`

```
⟦Q(S).Where(p)⟧ = [sᵢ | p(sᵢ, i) is true, preserving order]
```

**Laws** (verified via property-based tests in `tests/properties/where-laws.test.ts`):

1. **Idempotent**: `Where(p).Where(p)` ≡ `Where(p)`
2. **Commutative**: `Where(p).Where(q)` ≡ `Where(q).Where(p)` ≡ `Where((x, i) => p(x, i) && q(x, i))`

## Partitioning

| Operator | Definition |
|----------|------------|
| `Take(n)` | First `max(0, n)` elements |
| `Skip(n)` | Drop first `max(0, n)` elements |
| `TakeWhile(p)` | Prefix until first `p` false (exclusive) |
| `SkipWhile(p)` | Drop prefix while `p` true, emit rest |
| `TakeLast(n)` | Last `max(0, n)` elements (materializes) |
| `SkipLast(n)` | Drop last `max(0, n)` elements (materializes) |

Fusion: `Take(n).Take(m)` → `Take(min(n, m))`. `Skip(a).Skip(b)` → `Skip(a + b)`.

## Ordering

`OrderBy(key)` sorts **stably** by `key(x, i)` ascending using `defaultComparer`. `OrderByDescending` negates the comparison. `ThenBy` / `ThenByDescending` apply tie-break keys on equal primary keys.

**Stability**: equal primary keys retain relative input order.

`Reverse` materializes then reverses in memory.

**OrderByOptions:**
```ts
interface OrderByOptions {
  descending?: boolean;
  comparer?: Comparer<unknown>;
  nulls?: "first" | "last";
  localeCompare?: boolean | string;
}
```

## Grouping and Sets

- `Distinct()` — first occurrence wins (`Object.is` equality).
- `DistinctBy(key)` — first occurrence per key.
- `GroupBy(key)` — `IGrouping<K, T>` per key, stable group order by first appearance of key.
- `GroupByMany(...keys)` — multi-key grouping (composite key as array).

## Joins

All join variants **materialize** the lazy segment before joining.

| Operator | Description |
|----------|-------------|
| `Join(inner, outerKey, innerKey, result)` | Inner join; inner matches grouped by key |
| `GroupJoin(inner, outerKey, innerKey, result)` | Left outer: each outer gets a group (possibly empty) |
| `LeftJoin(inner, outerKey, innerKey, result)` | Left join (null for missing inner) |
| `RightJoin(inner, outerKey, innerKey, result)` | Right join (null for missing outer) |
| `FullJoin(inner, outerKey, innerKey, result)` | Full outer join (null for either side) |
| `Zip(second, result)` | Pairs by position until either sequence ends |

## Set Operators

| Operator | Definition |
|----------|------------|
| `Concat(second)` | `⟦first⟧` followed by `⟦second⟧` |
| `Union(second)` | Distinct multiset union; first-sequence order, then unseen from second |
| `Intersect(second)` | Elements of first appearing in second, at most once each (first order) |
| `Except(second)` | Elements of first not in second; duplicates preserved |
| `UnionBy(second, key)` | Distinct union by key selector |
| `IntersectBy(second, key)` | Intersection by key selector |
| `ExceptBy(second, key)` | Except by key selector |

Optional `EqualityComparer` defaults to `Object.is`.

## Unique Lazy Operators

| Operator | Description |
|----------|-------------|
| `WithIndex()` | Yields `{ value, index }` for each element |
| `Index()` | Yields `[index, value]` tuples |
| `Buffer(size, step?)` | Sliding windows of `size` advancing by `step` (default 1); full windows only |
| `TryWhere(p)` | Like `Where(p)` but skips when predicate throws |
| `Pairwise()` | Yields `[previous, current]` for adjacent pairs; empty if < 2 elements |
| `Tap(action)` | Invokes `action(item, index)`, yields item unchanged |
| `Flatten()` | One-level flatten for `Iterable<U>` elements |
| `AdjacentDistinct(eq?)` | Drops consecutive duplicates only |
| `Prepend(items)` | Yields `items` then pipeline elements (non-materializing) |
| `Append(items)` | Yields pipeline then `items` (non-materializing) |
| `Scan(seed, fn)` | Yields `seed`, then running `fn(acc, item, i)` |
| `Chunk(size)` | Consecutive groups of `size`; final may be smaller |
| `DefaultIfEmpty(x)` | Yields `[x]` if pipeline yields nothing |

## Aggregation Semantics

| Terminal | Empty Sequence |
|----------|----------------|
| `Count()` | `0` |
| `LongCount()` | `0` |
| `Sum()` | `0` |
| `Min()` / `Max()` / `Average()` | Throws `EmptySequenceError` |
| `MinBy()` / `MaxBy()` | Throws `EmptySequenceError` |
| `Median()` / `Mode()` / `Percentile()` | Throws `EmptySequenceError` |
| `Aggregate(seed, fn)` | Returns `seed` |
| `Reduce(fn)` (no seed) | Throws `EmptySequenceError` |
| `Reduce(seed, fn)` | Returns `seed` |
| `CountBy(key)` | Returns empty `Map` |

With selector `sel`, aggregations apply to `sel(x, i)` values.

## Element Operators

| Terminal | Empty | Multiple |
|----------|-------|----------|
| `First()` | Throw | First |
| `FirstOrDefault(d)` | `d` | First |
| `Last()` | Throw | Last |
| `LastOrDefault(d)` | `d` | Last |
| `Single()` | Throw | Throw if >1 |
| `SingleOrDefault(d)` | `d` | Throw if >1 |
| `ElementAt(k)` | Throw if `k < 0` or out of range | Element at k |
| `ElementAtOrDefault(k, d)` | `d` if `k < 0` or out of range | Element at k |

## Quantifiers

- `Any(p?)` — true if any element matches `p` (or any element if `p` omitted).
- `All(p)` — true on empty sequence (vacuous truth).
- `Contains(v, eq?)` — linear search with `eq` defaulting to `Object.is`.
- `SequenceEqual(other, eq?)` — pairwise zip with `eq`; lengths must match.

## Side Effects and Purity

- **`Tap(action)`**: Intended for side effects (logging, debugging). The action receives each item and its index but cannot modify the stream.
- **`ForEach(action)`**: Terminal side-effect operator.
- Operators are **pure** with respect to the source: they do not mutate the source iterable. However, if the source is a generator with state, repeated iteration may produce different results.

## Infinite Sequences

Not a design target. `Take` / `TakeWhile` may bound consumption; unbounded sources may hang on `ToArray` or aggregations.

## Async (`QAsync`)

`⟦QAsync(S).op…⟧` equals sync semantics on the ordered multiset of async yields. Materializing ops buffer async input to an array, then run the same logic as sync.

Early termination: terminals such as `FirstAsync` stop pulling the async source once satisfied.

## Property-Based Test Verification

| Law | File | Tools |
|-----|------|-------|
| Select identity | `tests/properties/select-laws.test.ts` | fast-check |
| Select composition | `tests/properties/select-laws.test.ts` | fast-check |
| Where idempotent | `tests/properties/where-laws.test.ts` | fast-check |
| Where commutative | `tests/properties/where-laws.test.ts` | fast-check |

## References

- [QUERY_API.md](./QUERY_API.md) — complete operator reference
- [ERRORS.md](./ERRORS.md) — error handling semantics
