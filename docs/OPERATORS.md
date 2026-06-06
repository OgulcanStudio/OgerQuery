# Lazy Operators Reference

All 24 lazy operators. These build the pipeline without iterating; execution begins at a terminal operator.

## Fusible Operators

These 4 operators participate in fusion optimization and the array fast path.

### Where

Filter elements matching a predicate. Adjacent `Where` predicates merge via `&&`.

```ts
kind: 'where'
predicate: Predicate<T>  // (item: T, index?: number) => boolean
```

```ts
Q([1, 2, 3, 4, 5])
  .Where((x) => x % 2 === 0)
  .ToArray();  // [2, 4]

// Fusion: consecutive Where predicates combine
Q([1, 2, 3, 4, 5])
  .Where((x) => x > 2)
  .Where((x) => x % 2 !== 0)
  .ToArray();  // [3, 5]
```

### Select

Transform each element. Adjacent `Select` selectors compose via function chaining.

```ts
kind: 'select'
selector: Selector<T, R>  // (item: T, index?: number) => R
```

```ts
Q([1, 2, 3])
  .Select((x) => x * 10)
  .ToArray();  // [10, 20, 30]

// Fusion: consecutive Select selectors compose
Q([1, 2, 3])
  .Select((x) => x + 1)
  .Select((x) => String(x))
  .ToArray();  // ['2', '3', '4']
```

### Take

Take the first N elements. Adjacent `Take` ops use `Math.min`.

```ts
kind: 'take'
count: number  // must be >= 0
```

```ts
Q([1, 2, 3, 4, 5])
  .Take(3)
  .ToArray();  // [1, 2, 3]

// Fusion: min of consecutive Take counts
Q([1, 2, 3, 4, 5])
  .Take(4)
  .Take(2)
  .ToArray();  // [1, 2]
```

### Skip

Skip the first N elements. Adjacent `Skip` ops sum their counts.

```ts
kind: 'skip'
count: number  // must be >= 0
```

```ts
Q([1, 2, 3, 4, 5])
  .Skip(2)
  .ToArray();  // [3, 4, 5]

// Fusion: consecutive Skip counts add
Q([1, 2, 3, 4, 5])
  .Skip(1)
  .Skip(2)
  .ToArray();  // [4, 5]
```

## Non-Fusible Lazy Operators

### SelectMany

Flat-map: project each element to an iterable, then flatten.

```ts
kind: 'selectMany'
selector: Selector<T, Iterable<R>>  // (item: T, index?: number) => Iterable<R>
```

```ts
Q([[1, 2], [3, 4]])
  .SelectMany((x) => x)
  .ToArray();  // [1, 2, 3, 4]
```

### OfType

Filter to only object-type elements (non-null, non-undefined, `typeof === 'object'`).

```ts
kind: 'ofType'
```

```ts
Q([1, null, { a: 1 }, 'test', undefined, [2]])
  .OfType()
  .ToArray();  // [{ a: 1 }, [2]]
```

### Cast

TypeScript type assertion — runtime no-op, passes elements through.

```ts
kind: 'cast'
```

```ts
Q([1, 2, 3])
  .Cast<string>()
  .ToArray();  // [1, 2, 3] (typed as string[])
```

### TakeWhile

Take elements while the predicate is true; stop at the first false.

```ts
kind: 'takeWhile'
predicate: Predicate<T>
```

```ts
Q([1, 2, 3, 4, 1, 2])
  .TakeWhile((x) => x < 4)
  .ToArray();  // [1, 2, 3]
```

### SkipWhile

Skip elements while the predicate is true; yield the rest.

```ts
kind: 'skipWhile'
predicate: Predicate<T>
```

```ts
Q([1, 2, 3, 4, 1, 2])
  .SkipWhile((x) => x < 3)
  .ToArray();  // [3, 4, 1, 2]
```

### TakeLast

Take the last N elements (buffers up to N elements).

```ts
kind: 'takeLast'
count: number
```

```ts
Q([1, 2, 3, 4, 5])
  .TakeLast(2)
  .ToArray();  // [4, 5]
```

### SkipLast

Skip the last N elements (buffers up to N elements).

```ts
kind: 'skipLast'
count: number
```

```ts
Q([1, 2, 3, 4, 5])
  .SkipLast(2)
  .ToArray();  // [1, 2, 3]
```

### DefaultIfEmpty

If the source is empty, yield the default value.

```ts
kind: 'defaultIfEmpty'
defaultValue: T
```

```ts
Q([])
  .DefaultIfEmpty(42)
  .ToArray();  // [42]

Q([1, 2])
  .DefaultIfEmpty(42)
  .ToArray();  // [1, 2]
```

### Chunk

Split into fixed-size batches. The final batch may be smaller.

```ts
kind: 'chunk'
size: number  // must be > 0
```

```ts
Q([1, 2, 3, 4, 5])
  .Chunk(2)
  .ToArray();  // [[1, 2], [3, 4], [5]]
```

### Scan

Running accumulator: yields the seed, then each accumulated value.

```ts
kind: 'scan'
seed: unknown
func: (acc: unknown, item: T, index: number) => unknown
```

```ts
Q([1, 2, 3])
  .Scan(0, (acc, x) => acc + x)
  .ToArray();  // [0, 1, 3, 6]
```

### WithIndex

Pair each element with its 0-based index as `{ value: T, index: number }`.

```ts
kind: 'withIndex'
```

```ts
Q(['a', 'b'])
  .WithIndex()
  .ToArray();  // [{ value: 'a', index: 0 }, { value: 'b', index: 1 }]
```

### Index

Pair each element with its 0-based index as `[number, T]` tuples.

```ts
kind: 'index'
```

```ts
Q(['a', 'b'])
  .Index()
  .ToArray();  // [[0, 'a'], [1, 'b']]
```

### Buffer

Sliding window of fixed size with configurable step.

```ts
kind: 'buffer'
size: number  // must be > 0
step: number  // must be > 0, default: 1
```

```ts
Q([1, 2, 3, 4])
  .Buffer(2)
  .ToArray();  // [[1, 2], [2, 3], [3, 4]]

Q([1, 2, 3, 4])
  .Buffer(2, 2)
  .ToArray();  // [[1, 2], [3, 4]]
```

### TryWhere

Like `Where` but skips elements whose predicate throws an error.

```ts
kind: 'tryWhere'
predicate: Predicate<T>
```

```ts
Q([1, 2, 3, 4])
  .TryWhere((x) => {
    if (x === 2) throw new Error('boom');
    return x % 2 === 0;
  })
  .ToArray();  // [4]
```

### Pairwise

Emit consecutive pairs as `[previous, current]`.

```ts
kind: 'pairwise'
```

```ts
Q([1, 2, 3, 4])
  .Pairwise()
  .ToArray();  // [[1, 2], [2, 3], [3, 4]]
```

### Tap

Side-effect passthrough: execute an action for each element, then yield it unchanged.

```ts
kind: 'tap'
action: (item: T, index: number) => void
```

```ts
Q([1, 2, 3])
  .Tap((x, i) => console.log(`[${i}]: ${x}`))
  .ToArray();  // logs [0]: 1, [1]: 2, [2]: 3; returns [1, 2, 3]
```

### Flatten

One-level flatten: for each iterable element, yield its items.

```ts
kind: 'flatten'
```

```ts
Q([[1, 2], [3]])
  .Flatten()
  .ToArray();  // [1, 2, 3]
```

### AdjacentDistinct

Remove consecutive duplicate elements (linearly, not globally).

```ts
kind: 'adjacentDistinct'
comparer?: EqualityComparer<T>
```

```ts
Q([1, 1, 2, 2, 1, 3, 3])
  .AdjacentDistinct()
  .ToArray();  // [1, 2, 1, 3]

// Custom comparer
Q(['a', 'A', 'b', 'b'])
  .AdjacentDistinct((a, b) => a.toLowerCase() === b.toLowerCase())
  .ToArray();  // ['a', 'b']
```

### Prepend

Prepend elements from an iterable before the source.

```ts
kind: 'prepend'
items: Iterable<T>
```

```ts
Q([3, 4])
  .Prepend([1, 2])
  .ToArray();  // [1, 2, 3, 4]
```

### Append

Append elements from an iterable after the source.

```ts
kind: 'append'
items: Iterable<T>
```

```ts
Q([1, 2])
  .Append([3, 4])
  .ToArray();  // [1, 2, 3, 4]
```

## Fusion Rules Summary

| Operator | Fusion behavior |
|----------|-----------------|
| `Where` + `Where` | Merge predicates with `item => p1(item) && p2(item)` |
| `Select` + `Select` | Compose selectors: `item => s2(s1(item))` |
| `Take` + `Take` | Use `Math.min(count1, count2)` |
| `Skip` + `Skip` | Sum counts: `count1 + count2` |
| All others | No fusion; ops are appended individually |

## Array Fast Path Eligibility

The array fast path activates when:
1. Source is `T[]` (detected via `isArray`)
2. Pipeline contains **only** fusible ops: `Where`, `Select`, `Take`, `Skip`

Specialized paths for 1-op, 2-op (where+select, where+take, select+take), and 3-op (where+select+take, where+skip+take) combinations exist with direct index-based loops.
