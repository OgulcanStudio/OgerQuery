# OgerQuery Utilities

Reference for internal utility modules exposed via package exports.

## Comparer Utilities

### `comparer.ts`

```ts
import { compareWith, equalsWith } from "ogerquery";
```

**`compareWith(a, b, comparer?)`** — Compares two values using optional comparer (defaults to `defaultComparer`). Returns negative, zero, or positive number.

```ts
compareWith(5, 3);  // 1 (positive)
compareWith(3, 5);  // -1 (negative)
compareWith(5, 5);  // 0
```

**`equalsWith(a, b, comparer?)`** — Tests equality using optional comparer (defaults to `Object.is`).

```ts
equalsWith(5, 5);           // true
equalsWith(NaN, NaN);       // true (Object.is behavior)
equalsWith(5, "5");         // false
```

### `defaultComparer.ts`

The default comparer handles common types with sensible ordering:

```ts
import { defaultComparer, type Comparer } from "ogerquery";
```

**Comparison rules:**
1. `Object.is(a, b)` → return `0`
2. `null`/`undefined` sorts before any value; both `null` are equal
3. Same primitive type (`string`, `number`, `bigint`) → native `<` / `>` comparison
4. Fallback → `String(a)` < `String(b)` lexicographic comparison

## Type Guards

### `isArray(value)`

Type guard that narrows `Iterable<T>` to `T[]`:

```ts
import { isArray } from "ogerquery";

function process(source: Iterable<number>) {
  if (isArray(source)) {
    // source is number[] — can use array methods
    return source.length;
  }
  return 0;
}
```

## Property Path Resolution

### `path.ts`

Utilities for safe property access on nested objects using dot notation.

```ts
import { getByPath, isSafePropertyKey, filterFieldRoot, compareNullSortKeys } from "ogerquery";
```

**`getByPath(obj, path)`** — Retrieves a nested property by dot-notation path. Returns `undefined` for missing intermediate values.

```ts
getByPath({ a: { b: 42 } }, "a.b");     // 42
getByPath({ a: { b: 42 } }, "a.b.c");   // undefined
getByPath(null, "a");                     // undefined
```

Paths are validated against regex `/^[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*$/` — throws on invalid paths.

**`isSafePropertyKey(key)`** — Prevents prototype pollution.

```ts
isSafePropertyKey("name");        // true
isSafePropertyKey("__proto__");   // false
isSafePropertyKey("constructor"); // false
isSafePropertyKey("prototype");   // false
```

**`filterFieldRoot(field)`** — Extracts the first segment of a dot-path.

```ts
filterFieldRoot("profile.age");  // "profile"
filterFieldRoot("name");          // "name"
```

**`compareNullSortKeys(ka, kb, nulls)`** — Compares two sort keys with null handling. Returns `null` if neither is null.

```ts
compareNullSortKeys(null, 5, "first");  // -1 (nulls first)
compareNullSortKeys(null, 5, "last");   // 1 (nulls last)
compareNullSortKeys(3, 5, "first");     // null (neither null)
```

## Join/Lookup Data Structures

### `joinLookup.ts`

Internal utilities for building join lookups.

```ts
import { buildJoinLookup, findJoinMatches } from "ogerquery";
```

**`buildJoinLookup(inner, innerKeySelector, comparer?)`** — Builds a `Map`-based lookup for join operations.

**`findJoinMatches(lookup, key, eq)`** — Finds all inner matches for a given outer key.

```ts
const { lookup, eq } = buildJoinLookup(
  [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }],
  (x) => x.id,
);
const matches = findJoinMatches(lookup, 1, eq);
// [{ id: 1, name: "Alice" }]
```

## Iterable Resolution

### `resolveIterable(source)`

Resolves a sync or async iterable to a sync iterable (buffers async sources to array).

```ts
import { resolveIterable } from "ogerquery";

const resolved = await resolveIterable(asyncGenerator);
// Returns T[] (buffered) if async, or the source directly if sync
```

### `resolveMaterializingOpSecond(op)`

Resolves the `second` iterable of set operations (`concat`, `union`, `intersect`, `except`, and `*By` variants) from async to sync.

```ts
import { resolveMaterializingOpSecond } from "ogerquery";

const resolvedOp = await resolveMaterializingOpSecond(pipelineOp);
```

## Option Type

### `option.ts`

Functional optional value type (Some/None pattern).

```ts
import { some, None, fromNullable, type Option } from "ogerquery";
```

| Constructor | Returns | Description |
|-------------|---------|-------------|
| `some(value)` | `Some<T>` | Wraps a value: `{ ok: true, value }` |
| `None` | `None` | Singleton: `{ ok: false }` |
| `fromNullable(val)` | `Option<T>` | `some(val)` if non-null, else `None` |

```ts
const opt: Option<number> = some(42);
opt.ok;       // true
opt.value;    // 42

const none = fromNullable(null);
none.ok;      // false
```

## Result Type

```ts
import { ok, err, type Result, tryRun, tryRunSync } from "ogerquery";
```

| Constructor | Returns | Description |
|-------------|---------|-------------|
| `ok(value)` | `Ok<T>` | Success: `{ ok: true, value }` |
| `err(error)` | `Err<E>` | Failure: `{ ok: false, error }` |
| `tryRunSync(fn)` | `Result<T, Error>` | Wraps throwing sync fn |
| `tryRun(fn)` | `Promise<Result<T, Error>>` | Wraps throwing async fn |

## Pagination Types

### `types.ts`

```ts
import {
  PageResult,
  CursorPageResult,
  createPageResult,
  clampPageSize,
  DEFAULT_MAX_PAGE_SIZE,
} from "ogerquery";
```

**`PageResult<T>`**
```ts
interface PageResult<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}
```

**`CursorPageResult<T>`**
```ts
interface CursorPageResult<T, TCursor = string> {
  readonly items: readonly T[];
  readonly nextCursor: TCursor | null;
  readonly hasNext: boolean;
}
```

**`createPageResult(items, page, pageSize, total)`** — Creates a `PageResult<T>` with computed metadata.

**`clampPageSize(pageSize, max?)`** — Clamps page size to `[1, max]` (default max: 1000).

## Debug/Explain System

### `explain.ts`

Pipeline visualization and debug utilities.

```ts
import { explainPipeline, explainPipelineText, setDebugMode, isDebugMode, debugLog, type ExplainStep } from "ogerquery";
```

**`explainPipeline(pipeline)`** — Returns array of `ExplainStep` objects describing each pipeline operation.

**`explainPipelineText(pipeline)`** — Returns human-readable strings.

```ts
const query = Q([1, 2, 3])
  .Where((x) => x > 0)
  .Select((x) => x * 2)
  .Take(5);

query.ExplainText();
// ["0: where", "1: select", "2: take (count=5)"]
```

**`ExplainStep` type:**
```ts
type ExplainStep = {
  index: number;
  kind: string;
  detail?: string;
};
```

**`setDebugMode(enabled)` / `isDebugMode()`** — Global debug flag.

**`debugLog(message, ...args)`** — Conditional console.debug output.

```ts
setDebugMode(true);
debugLog("Processing %d items", count);
// [OgerQuery] Processing 100 items
```

See [EXPLAIN.md](./EXPLAIN.md) for full documentation.

## See Also

- [QUERY_API.md](./QUERY_API.md) — operator reference
- [FILTERING.md](./FILTERING.md) — predicate builders
- [ERRORS.md](./ERRORS.md) — Option/Result usage patterns
- [EXPLAIN.md](./EXPLAIN.md) — debug system
