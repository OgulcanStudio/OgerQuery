# Pipeline Internals

Understanding how OgerQuery executes pipelines helps optimize performance.

## Pipeline Architecture

```
Source → [Lazy Fusible Ops] → [Materializing Op] → [Lazy Ops] → Terminal
```

### Operator Kinds

| Kind | Count | Examples | Behavior |
|------|-------|----------|----------|
| **Lazy Fusible** | 4 | `Where`, `Select`, `Take`, `Skip` | Fuse into single loop; array fast path eligible |
| **Lazy Non-Fusible** | 20 | `Chunk`, `Scan`, `WithIndex`, `Buffer`, `TryWhere`, `Pairwise`, `Tap`, `Flatten`, `AdjacentDistinct`, `Prepend`, `Append`, etc. | Stream but don't fuse |
| **Materializing** | 25 | `OrderBy`, `Reverse`, `GroupBy`, `Distinct`, `Join`, `Zip`, `Concat`, `Union`, `Intersect`, `Except` | Buffer to array, then process |
| **Terminal** | 42 | `ToArray`, `First`, `Count`, `Sum`, `ForEach`, etc. | Execute and return result |

## Execution Flow

```
Q(source)
  .Where(p1)           // Lazy fusible
  .Select(s1)          // Lazy fusible
  .Take(10)            // Lazy fusible
  .OrderBy(k1)         // Materializing → flushes previous to array
  .Where(p2)           // Lazy fusible (new segment)
  .ToArray();          // Terminal → executes all segments
```

### Segmented Execution (`runSegmented`)

```ts
function* runSegmented(source, ops) {
  let current = source;
  let i = 0;
  while (i < ops.length) {
    // 1. Collect lazy fusible ops into a batch
    const lazyBatch = [];
    while (i < ops.length && !isMaterializing(ops[i])) {
      lazyBatch.push(ops[i++]);
    }
    // 2. Apply each lazy op via wrapLazy (iterator wrapping)
    for (const op of lazyBatch) {
      current = wrapLazy(current, op);
    }
    // 3. Execute materializing op (flushes to array)
    if (i < ops.length) {
      current = materialize(current, ops[i++]);
    }
  }
  yield* current;
}
```

### `wrapLazy`

Looks up the feature plugin by `op.kind`, calls `executeSync` to wrap the source iterable:

```ts
export function wrapLazy(source, op) {
  const feature = FeatureRegistry.get(op.kind);
  if (feature && feature.executeSync) {
    return feature.executeSync(source, op);
  }
  return source;
}
```

### `materialize`

Same lookup but for materializing ops; collects upstream into array then processes:

```ts
export function materialize(source, op) {
  const feature = FeatureRegistry.get(op.kind);
  if (feature && feature.executeSync) {
    return feature.executeSync(source, op);
  }
  return source;
}
```

## Fusion Optimization

Adjacent fusible operators combine automatically via the `append` hook:

### Where + Where → merged predicate

```ts
// Ops: [{kind:'where', predicate: p1}, {kind:'where', predicate: p2}]
// Becomes: {kind:'where', predicate: (item, idx) => p1(item, idx) && p2(item, idx)}
```

### Select + Select → composed selector

```ts
// Ops: [{kind:'select', selector: s1}, {kind:'select', selector: s2}]
// Becomes: {kind:'select', selector: (item, idx) => s2(s1(item, idx), idx)}
```

### Take + Take → min

```ts
// Ops: [{kind:'take', count: c1}, {kind:'take', count: c2}]
// Becomes: {kind:'take', count: Math.min(c1, c2)}
```

### Skip + Skip → sum

```ts
// Ops: [{kind:'skip', count: c1}, {kind:'skip', count: c2}]
// Becomes: {kind:'skip', count: c1 + c2}
```

### Fusion is a side-effect of `append`

Each `append` call checks `pipeline.last`. If the last op is fusible with the new one, it calls `pipeline.replaceLast(op)` instead of `pipeline.append(op)`. This happens at pipeline construction time, before any iteration.

## Array Fast Path

When source is `T[]` and pipeline contains only fusible ops, the executor uses `arrayFastPath` — direct index-based loops without iterator wrapper overhead.

```ts
function canUseArrayFastPath(ops): boolean {
  return ops.every(op => isLazyFusableOp(op));
}
// isLazyFusableOp: where, select, take, skip
```

### Specialized paths

| Op count | Combinations | Behavior |
|----------|-------------|----------|
| 1 | any fusible | Direct single-op loop |
| 2 | where+select | Filter+map in one loop |
| 2 | where+take | Filter with early exit |
| 2 | select+take | Map with early exit |
| 3 | where+select+take | Filter+map with early exit |
| 3 | where+skip+take | Filter+skip+take in one pass |
| N (fallback) | any fusible mix | Step-based loop with per-op state machine |

## Sync Execution (`executor.ts`)

### `executePipeline`

```ts
function* executePipeline<T>(source: Iterable<T>, pipeline: OpPipeline<T>): Generator<T>
```

1. Empty pipeline → `yield* source`
2. Array + fusible only → `yield* arrayFastPath(source, ops)`
3. Otherwise → `yield* runSegmented(source, ops)`

### `toIterable`

Wraps `executePipeline` into an `Iterable`:

```ts
export function toIterable(source, pipeline) {
  return {
    [Symbol.iterator]() {
      return executePipeline(source, pipeline);
    },
  };
}
```

## Async Execution (`asyncExecutor.ts`)

### `executeAsyncPipeline`

```ts
async function* executeAsyncPipeline<T>(
  source: AsyncIterable<T>,
  pipeline: OpPipeline<T>,
  signal?: AbortSignal
): AsyncGenerator<T>
```

Key differences from sync:

1. **AbortSignal** — checks `signal?.aborted` at each step; throws `AbortError`
2. **Lazy batch handling** — `applyAsyncLazyBatch` collects to array, runs sync executor, then returns async iterable
3. **Materializing ops** — `resolveMaterializingOpSecond` resolves async inner iterables, then `collectToArray` buffers upstream before processing
4. **Terminal pattern** — async terminals await `collectToArray` then delegate to sync `runSync` with `emptyPipeline`

### Async lazy batch execution

```ts
function applyAsyncLazyBatch(source, ops, signal) {
  return {
    async *[Symbol.asyncIterator]() {
      yield* executePipeline(
        await collectToArray(source, signal),  // buffer async → array
        { ops } as OpPipeline<T>               // run sync executor
      );
    },
  };
}
```

### Materializing in async context

```ts
// For each materializing op:
const op = await resolveMaterializingOpSecond(ops[i]);  // resolve async inner
const materialized = materialize(
  await collectToArray(current, signal),  // buffer upstream
  op                                       // run materializing op sync
);
current = asyncFromIterable(materialized); // convert back to async
```

## Pipeline Debugging

```ts
const query = Q(data).Where(...).Select(...).OrderBy(...);

// Inspect pipeline structure
console.log(query.Explain());
// [{ kind: 'where', index: 0 }, { kind: 'select', index: 1 }, { kind: 'orderBy', index: 2, keys: [...] }]

console.log(query.ExplainText());
// ["where → select → orderBy"]

// Enable debug logging
import { setDebugMode, debugLog } from "ogerquery";
setDebugMode(true);
```

## Performance Tips

1. **Put `Take`/`Skip` early** — limits work for downstream ops
2. **Filter before projecting** — `Where` before `Select` reduces allocations
3. **Avoid unnecessary materialization** — don't `ToArray()` then re-query
4. **Use array sources** — enables fast path for fusible pipelines
5. **Prefer `Any` over `Count > 0`** — short-circuits early
6. **Use `FirstOrDefault` instead of `First` + try/catch** — avoids exception overhead
7. **Use `AggregateBy` for group-aware aggregation** — more efficient than `GroupBy` + `Select` + `Aggregate`

## OpPipeline Class

```ts
class OpPipeline<T> {
  readonly ops: PipelineOp<T>[];

  constructor(ops?: PipelineOp<T>[]);
  append(op: PipelineOp<T>): OpPipeline<T>;       // Immutable: returns new pipeline
  replaceLast(op: PipelineOp<T>): OpPipeline<T>;   // Replace last op (for fusion)
  get last(): PipelineOp<T> | undefined;            // Peek at last op
  isEmpty(): boolean;
}
```

## Pipeline Segmentation Detection

```ts
function isMaterializingOpAt(ops, index): boolean {
  const feature = FeatureRegistry.get(ops[index].kind);
  return feature?.category === 'materializing';
}

function isMaterializingOp(op): boolean {
  const feature = FeatureRegistry.get(op.kind);
  return feature?.category === 'materializing';
}
```

The segmentation boundary is determined at runtime by looking up each op's `kind` in the `FeatureRegistry`.
