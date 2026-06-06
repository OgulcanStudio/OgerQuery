# Materializing Operators

All 25 materializing operators. These flush the pipeline to an array before processing, then yield results. In segmented execution, materializing ops terminate the current lazy segment and start a new one.

## Ordering

### OrderBy

Sort elements ascending by a key selector. Uses stable sort.

```ts
kind: 'orderBy'
keys: OrderKeyEntry<T>[]
```

```ts
Q([3, 1, 2])
  .OrderBy((x) => x)
  .ToArray();  // [1, 2, 3]

// With custom comparer
Q(['apple', 'banana', 'cherry'])
  .OrderBy((x) => x, { comparer: (a, b) => b.length - a.length })
  .ToArray();  // ['banana', 'cherry', 'apple']

// With localeCompare
Q(['banana', 'apple', 'cherry'])
  .OrderBy((x) => x, { localeCompare: true })
  .ToArray();  // ['apple', 'banana', 'cherry']
```

### OrderByDescending

Sort elements descending by a key selector.

```ts
Q([3, 1, 2])
  .OrderByDescending((x) => x)
  .ToArray();  // [3, 2, 1]
```

### Order

Sort elements by their natural order (identity key selector).

```ts
kind: 'orderBy' (via OrderBy, with identity key)
```

```ts
Q([3, 1, 2])
  .Order()
  .ToArray();  // [1, 2, 3]
```

### OrderDescending

Sort elements by their natural order descending.

```ts
Q([3, 1, 2])
  .OrderDescending()
  .ToArray();  // [3, 2, 1]
```

### ThenBy

Secondary sort ascending. Appends a sort key to the preceding `OrderBy`/`OrderByDescending`.

```ts
kind: 'orderBy' (merged with preceding orderBy)
```

```ts
Q([
  { a: 2, b: 10 },
  { a: 1, b: 20 },
  { a: 2, b: 5 },
])
  .OrderBy((x) => x.a)
  .ThenBy((x) => x.b)
  .ToArray();
// [{ a: 1, b: 20 }, { a: 2, b: 5 }, { a: 2, b: 10 }]
```

### ThenByDescending

Secondary sort descending.

```ts
Q([
  { a: 2, b: 5 },
  { a: 1, b: 20 },
  { a: 2, b: 10 },
])
  .OrderBy((x) => x.a)
  .ThenByDescending((x) => x.b)
  .ToArray();
// [{ a: 1, b: 20 }, { a: 2, b: 10 }, { a: 2, b: 5 }]
```

### OrderByOptions

```ts
type OrderByOptions = {
  descending?: boolean;
  comparer?: Comparer<any>;
  nulls?: 'first' | 'last';
  localeCompare?: boolean | string;
};
```

### orderByHelpers

The `orderByHelpers` module provides:

```ts
function toEntry(keySelector, options?: OrderByOptions): OrderKeyEntry;
function compareOrderKeys(ka, kb, entry): number;
function stableSortInPlace(arr, keys: OrderKeyEntry[]): void;
```

### Reverse

Reverse the element order (materializes to array, then reverses).

```ts
kind: 'reverse'
```

```ts
Q([1, 2, 3])
  .Reverse()
  .ToArray();  // [3, 2, 1]
```

## Distinct

### Distinct

Remove duplicate elements (first occurrence wins). Uses `Object.is` by default.

```ts
kind: 'distinct'
comparer?: EqualityComparer<T>
```

```ts
Q([1, 2, 2, 3, 1])
  .Distinct()
  .ToArray();  // [1, 2, 3]

// Custom comparer
Q([1, 1, 2])
  .Distinct((a, b) => a === b)
  .ToArray();  // [1, 2]
```

### DistinctBy

Remove duplicates based on a key selector.

```ts
kind: 'distinctBy'
keySelector: Selector<T, K>
comparer?: EqualityComparer<K>
```

```ts
Q([
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
  { id: 1, name: 'c' },
])
  .DistinctBy((x) => x.id)
  .ToArray();
// [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]
```

## Set Operations

### Concat

Concatenate two sequences (source first, then second).

```ts
kind: 'concat'
second: Iterable<T> | AsyncIterable<T>
```

```ts
Q([1, 2])
  .Concat([3, 4])
  .ToArray();  // [1, 2, 3, 4]
```

### Union

Distinct union of two sequences (first-sequence order).

```ts
kind: 'union'
second: Iterable<T> | AsyncIterable<T>
comparer?: EqualityComparer<T>
```

```ts
Q([1, 2, 2])
  .Union([2, 3])
  .ToArray();  // [1, 2, 3]
```

### Intersect

Elements present in both sequences (first-sequence order).

```ts
kind: 'intersect'
second: Iterable<T> | AsyncIterable<T>
comparer?: EqualityComparer<T>
```

```ts
Q([1, 2, 3])
  .Intersect([2, 4])
  .ToArray();  // [2]
```

### Except

Elements in first sequence but not in second.

```ts
kind: 'except'
second: Iterable<T> | AsyncIterable<T>
comparer?: EqualityComparer<T>
```

```ts
Q([1, 2, 3])
  .Except([2])
  .ToArray();  // [1, 3]
```

### UnionBy

Distinct union using a key selector.

```ts
kind: 'unionBy'
second: Iterable<T>
keySelector: Selector<T, K>
comparer?: EqualityComparer<K>
```

```ts
Q([{ id: 1 }, { id: 2 }])
  .UnionBy([{ id: 2 }, { id: 3 }], (x) => x.id)
  .ToArray();
// [{ id: 1 }, { id: 2 }, { id: 3 }]
```

### IntersectBy

Intersection using a key selector.

```ts
kind: 'intersectBy'
second: Iterable<K>
keySelector: Selector<T, K>
comparer?: EqualityComparer<K>
```

```ts
Q([{ id: 1 }, { id: 2 }, { id: 3 }])
  .IntersectBy([2, 3, 4], (x) => x.id)
  .ToArray();
// [{ id: 2 }, { id: 3 }]
```

### ExceptBy

Difference using a key selector.

```ts
kind: 'exceptBy'
second: Iterable<K>
keySelector: Selector<T, K>
comparer?: EqualityComparer<K>
```

```ts
Q([{ id: 1 }, { id: 2 }, { id: 3 }])
  .ExceptBy([2, 4], (x) => x.id)
  .ToArray();
// [{ id: 1 }, { id: 3 }]
```

## Grouping

### GroupBy

Group elements by key. Returns `IGrouping<K, T>` objects (key + iterable of elements).

```ts
kind: 'groupBy'
keySelector: Selector<T, K>
elementSelector?: Selector<T, E>
```

```ts
Q([
  { key: 'A', val: 1 },
  { key: 'B', val: 2 },
  { key: 'A', val: 3 },
])
  .GroupBy((x) => x.key)
  .ToArray();
// [Grouping('A', [{key:'A',val:1}, {key:'A',val:3}]), Grouping('B', [{key:'B',val:2}])]

// With element selector
Q(items)
  .GroupBy((x) => x.key, (x) => x.val)
  .ToArray();
// [Grouping('A', [1, 3]), Grouping('B', [2])]
```

### GroupByMany

Group by multiple keys (composite key as array).

```ts
Q(items)
  .GroupByMany((x) => x.category, (x) => x.status)
  .ToArray();
```

## Joins

### Join

Inner join: pairs outer elements with matching inner elements.

```ts
kind: 'join'
inner: Iterable<TInner>
outerKeySelector: Selector<TOuter, TKey>
innerKeySelector: Selector<TInner, TKey>
resultSelector: (outer: TOuter, inner: TInner) => TResult
comparer?: EqualityComparer<TKey>
```

```ts
Q([{ id: 1, name: 'a' }, { id: 2, name: 'b' }])
  .Join(
    [{ id: 1, role: 'Admin' }, { id: 3, role: 'User' }],
    (o) => o.id,
    (i) => i.id,
    (o, i) => ({ name: o.name, role: i.role }),
  )
  .ToArray();
// [{ name: 'a', role: 'Admin' }]
```

### GroupJoin

Left outer join that groups matching inner elements into an array.

```ts
kind: 'groupJoin'
inner: Iterable<TInner>
resultSelector: (outer: TOuter, inner: Iterable<TInner>) => TResult
```

```ts
Q([{ id: 1 }, { id: 2 }])
  .GroupJoin(
    [{ id: 1, role: 'Admin' }, { id: 1, role: 'User' }],
    (o) => o.id,
    (i) => i.id,
    (o, inners) => ({ id: o.id, roles: inners.map(r => r.role) }),
  )
  .ToArray();
// [{ id: 1, roles: ['Admin', 'User'] }, { id: 2, roles: [] }]
```

### LeftJoin

Left outer join: pairs with null for unmatched outer elements.

```ts
kind: 'leftJoin'
resultSelector: (outer: TOuter, inner: TInner | null) => TResult
```

```ts
Q([{ id: 1 }, { id: 2 }])
  .LeftJoin(
    [{ id: 1, role: 'Admin' }],
    (o) => o.id,
    (i) => i.id,
    (o, i) => ({ id: o.id, role: i ? i.role : null }),
  )
  .ToArray();
// [{ id: 1, role: 'Admin' }, { id: 2, role: null }]
```

### RightJoin

Right outer join: pairs with null for unmatched inner elements.

```ts
kind: 'rightJoin'
resultSelector: (outer: TOuter | null, inner: TInner) => TResult
```

```ts
Q([{ id: 1 }])
  .RightJoin(
    [{ id: 1, role: 'Admin' }, { id: 2, role: 'User' }],
    (o) => o.id,
    (i) => i.id,
    (o, i) => ({ name: o ? o.name : null, role: i.role }),
  )
  .ToArray();
// [{ name: 'a', role: 'Admin' }, { name: null, role: 'User' }]
```

### FullJoin

Full outer join: includes all elements from both sides with null fills.

```ts
kind: 'fullJoin'
resultSelector: (outer: TOuter | null, inner: TInner | null) => TResult
```

```ts
Q([{ id: 1 }, { id: 2 }])
  .FullJoin(
    [{ id: 1, role: 'Admin' }, { id: 3, role: 'User' }],
    (o) => o.id,
    (i) => i.id,
    (o, i) => ({ name: o?.name ?? null, role: i?.role ?? null }),
  )
  .ToArray();
// [{ name: 'a', role: 'Admin' }, { name: 'b', role: null }, { name: null, role: 'User' }]
```

### Zip

Pair elements from two sequences by position. Stops when either ends.

```ts
kind: 'zip'
second: Iterable<TSecond>
resultSelector: (first: T, second: TSecond) => TResult
```

```ts
Q([1, 2, 3])
  .Zip(['a', 'b'], (x, y) => `${x}-${y}`)
  .ToArray();  // ['1-a', '2-b']
```

## Aggregation by Key

### AggregateBy

Group elements by key and accumulate a running aggregate per group.

```ts
kind: 'aggregateBy'
keySelector: Selector<T, K>
seed: A | ((item: T) => A)
func: (acc: A, item: T) => A
comparer?: EqualityComparer<K>
```

```ts
Q([
  { category: 'A', value: 10 },
  { category: 'B', value: 20 },
  { category: 'A', value: 30 },
])
  .AggregateBy(
    (x) => x.category,
    0,
    (acc, item) => acc + item.value,
  )
  .ToArray();
// [['A', 40], ['B', 20]]

// With seed selector function (called per-group)
Q(items)
  .AggregateBy(
    (x) => x.category,
    (item) => item.value * 2,
    (acc, item) => acc + item.value,
  )
  .ToArray();
// [['A', 60], ['B', 60]]
```

## Materialization Behavior

All materializing operators:
1. Consume the upstream lazy pipeline into an array (`[...source]`)
2. Process the array (sort, group, join, etc.)
3. Yield results downstream (which may be consumed by more lazy ops or a terminal)

In **async** execution, the materializing step:
1. Awaits the entire async lazy segment into an array via `collectToArray`
2. Processes synchronously
3. Converts back to `AsyncIterable` for downstream lazy ops
