# Error Handling & Result Types

OgerQuery provides typed error classes for terminal operators and functional `Option`/`Result` types for safe error handling without try/catch.

## Error Classes

```ts
import {
  EmptySequenceError,
  MoreThanOneElementError,
  ArgumentOutOfRangeError,
  InvalidOperationError,
} from "ogerquery";
```

| Error | Thrown By | Description |
|-------|-----------|-------------|
| `EmptySequenceError` | `First`, `Last`, `Single`, `Min`, `Max`, `Average`, `MinBy`, `MaxBy`, `Median`, `Mode`, `Percentile`, `ElementAt`, `Reduce` (no seed) | Sequence has no elements |
| `MoreThanOneElementError` | `Single`, `SingleOrDefault`, `SingleOrThrow` | More than one matching element |
| `ArgumentOutOfRangeError` | `ElementAt` (negative index or out of bounds), `Chunk` (size <= 0) | Invalid index or non-positive size |
| `InvalidOperationError` | `Reduce` (no seed on empty), `ToDictionary`/`ToMap` (duplicate keys) | Operation invalid for current state |

All errors extend `Error` with descriptive messages and proper `.name` properties.

## `FirstOrThrow` / `SingleOrThrow` / `LastOrThrow`

These terminal operators behave identically to `First()` / `Single()` / `Last()` but are explicitly named for clarity.

```ts
Q([1, 2, 3]).FirstOrThrow(x => x > 5);   // EmptySequenceError
Q([1, 2, 3]).LastOrThrow();               // 3
Q([1]).SingleOrThrow();                    // 1
Q([1, 2]).SingleOrThrow();                 // MoreThanOneElementError
```

## Edge Cases

### Empty Sequences

Terminal behavior on empty sequences after pipeline:

| Terminal | Empty Behavior |
|----------|----------------|
| `Count()` / `LongCount()` | `0` |
| `Sum()` | `0` |
| `Min()` / `Max()` / `Average()` | Throws `EmptySequenceError` |
| `MinBy()` / `MaxBy()` | Throws `EmptySequenceError` |
| `Median()` / `Mode()` / `Percentile()` | Throws `EmptySequenceError` |
| `First()` / `Last()` / `Single()` | Throws `EmptySequenceError` |
| `FirstOrDefault(d)` | Returns `d` |
| `LastOrDefault(d)` | Returns `d` |
| `SingleOrDefault(d)` | Returns `d` |
| `ElementAt(k)` | Throws `ArgumentOutOfRangeError` |
| `ElementAtOrDefault(k, d)` | Returns `d` |
| `Aggregate(seed, fn)` | Returns `seed` |
| `Reduce(fn)` | Throws `EmptySequenceError` |
| `Reduce(seed, fn)` | Returns `seed` |
| `Any()` | `false` |
| `All(p)` | `true` (vacuous truth) |
| `DefaultIfEmpty(x)` | Yields `[x]` |

### Null/Undefined Handling

- `ElementAt` throws `ArgumentOutOfRangeError` for negative indices.
- `Take(-1)` / `Skip(-1)` / `Chunk(-1)` throw `RangeError`.
- `Range()` / `Repeat()` with negative count throw `RangeError`.
- `FirstOrDefault(d)` returns `d` (which may be `null`) if no match.
- `WhereEq` / `WhereNotEq` use `===` comparison (null !== undefined).
- `WhereNull` uses `== null` to catch both `null` and `undefined`.

## Option Type

A lightweight discriminated union for optional values (Some/None pattern).

```ts
import { some, None, fromNullable, type Option } from "ogerquery";

function findUser(id: number): Option<User> {
  const user = users.find((u) => u.id === id);
  return user ? some(user) : None;
}

const result = findUser(42);
if (result.ok) {
  console.log(result.value.name);
} else {
  console.log("Not found");
}
```

### Constructors

```ts
some(value)                               // Some<T>  => { ok: true, value }
None                                       // None     => { ok: false }
fromNullable(val)                          // val != null ? some(val) : None
```

### Methods (manual pattern matching)

```ts
result.ok       // boolean discriminator
result.value    // T (only when ok is true)
```

## Result Type

A discriminated union for operations that may fail (Ok/Err pattern).

```ts
import { ok, err, type Result, tryRun, tryRunSync } from "ogerquery";

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err("Division by zero");
  return ok(a / b);
}

const r = divide(10, 2);
if (r.ok) {
  console.log(r.value); // 5
} else {
  console.error(r.error);
}
```

### Constructors

```ts
ok(value)       // Ok<T>    => { ok: true, value }
err(error)      // Err<E>   => { ok: false, error }
```

## Safe Execution Helpers

### `tryRunSync(fn)`

Wraps a synchronous throwing function into a `Result`.

```ts
const result = tryRunSync(() => JSON.parse(input));
// Result<Parsed, Error>
```

### `tryRun(fn)`

Wraps an async throwing function into a `Promise<Result>`.

```ts
const result = await tryRun(async () => await fetchData());
// Result<Data, Error>
```

## Integration with Query Terminals

```ts
// Prefer OrDefault variants to avoid exceptions
const user = Q(users).FirstOrDefault(null, (u) => u.id === 42);

// Wrap terminals in Result
const result = tryRunSync(() => Q(users).First((u) => u.id === 42));
// Result<User, EmptySequenceError | MoreThanOneElementError>
```

## Best Practices

1. **Prefer `FirstOrDefault`/`SingleOrDefault`/`LastOrDefault`** over try/catch for expected-empty cases.
2. **Use `Option`** for nullable return values from functions.
3. **Use `Result`** for operations that can fail (parsing, IO, validation).
4. **Use `tryRunSync`/`tryRun`** to convert throwing APIs to `Result`.
5. **Check `.ok`** before accessing `.value` for type-safe handling.

## See Also

- [SEMANTICS.md](./SEMANTICS.md) — operator semantics and empty-sequence rules
- [QUERY_API.md](./QUERY_API.md) — terminal operator signatures
