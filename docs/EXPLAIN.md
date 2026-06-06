# OgerQuery Explain / Debug System

The explain/debug system provides pipeline introspection capabilities for understanding operator execution order and diagnosing query behavior.

## Source: `src/debug/explain.ts`

## Pipeline Visualization

### `query.Explain()` / `explainPipeline(pipeline)`

Returns an array of `ExplainStep` objects describing each operation in the pipeline.

```ts
import { Q } from "ogerquery";

const query = Q([1, 2, 3, 4, 5])
  .Where((x) => x > 0)
  .Select((x) => x * 2)
  .Skip(1)
  .Take(3);

const steps = query.Explain();
// [
//   { index: 0, kind: "where", detail: undefined },
//   { index: 1, kind: "select", detail: undefined },
//   { index: 2, kind: "skip", detail: "count=1" },
//   { index: 3, kind: "take", detail: "count=3" },
// ]
```

### `query.ExplainText()` / `explainPipelineText(pipeline)`

Returns human-readable strings for console output.

```ts
const lines = query.ExplainText();
// ["0: where", "1: select", "2: skip (count=1)", "3: take (count=3)"]

lines.forEach((line) => console.log(line));
```

## `ExplainStep` Type

```ts
type ExplainStep = {
  index: number;       // Position in pipeline (0-based)
  kind: string;        // Operation kind (where, select, take, skip, orderBy, etc.)
  detail?: string;     // Optional details (e.g., "count=5", "keys=1")
};
```

The `describeOp()` internal function enriches certain ops with detail:

| Op Kind | Detail Format |
|---------|---------------|
| `take` | `count=N` |
| `skip` | `count=N` |
| `orderBy` | `keys=N` (number of sort keys) |

## Debug Mode

### `setDebugMode(enabled)`

Enables or disables global debug logging. When enabled, `debugLog()` messages are printed to console.

```ts
import { setDebugMode, isDebugMode, debugLog } from "ogerquery";

setDebugMode(true);
console.log(isDebugMode()); // true

debugLog("Processing %d items", 100);
// [OgerQuery] Processing 100 items
```

### `debugLog(message, ...args)`

Conditional console output — only prints when debug mode is enabled. Prefixes messages with `[OgerQuery]`.

```ts
debugLog("Pipeline has %d ops", pipeline.ops.length);
// [OgerQuery] Pipeline has 4 ops
```

## Practical Usage

### Debugging complex pipelines:

```ts
const query = Q(orders)
  .Where((o) => o.status === "shipped")
  .Where((o) => o.amount >= 100)
  .OrderByDescending((o) => o.amount)
  .Take(50);

console.log(query.ExplainText());
// ["0: where", "1: where", "2: orderBy (keys=1)", "3: take (count=50)"]
```

### Using Explain with fusion:

Fusion collapses adjacent fusible ops. Explain shows the *fused* pipeline:

```ts
const query = Q([1, 2, 3])
  .Where((x) => x > 0)       // fused with next Where
  .Where((x) => x < 10)      // fused with above
  .Take(5)                    // fused with next Take
  .Take(3);                   // fused to min(5, 3) = 3

console.log(query.ExplainText());
// ["0: where", "1: take (count=3)"]
// Two Where ops fused into one; two Take ops fused into min count
```

### Integrating with error handling:

```ts
try {
  const result = Q(data)
    .Where(predicate)
    .OrderBy(key)
    .Take(10)
    .First();
} catch (err) {
  console.error("Pipeline:", Q(data).Where(predicate).ExplainText());
  throw err;
}
```

## API Design

The `Query` class exposes `Explain` and `ExplainText` as instance methods. The underlying `explainPipeline` and `explainPipelineText` functions also accept an `OpPipeline` directly for use in custom pipeline inspection.

```ts
// Via Query instance
const query = Q(source).Where(p).Select(f);
query.Explain();
query.ExplainText();

// Via utility functions
import { explainPipeline, explainPipelineText } from "ogerquery";
explainPipeline(query["pipeline"]);    // internal access
explainPipelineText(query["pipeline"]);
```

## See Also

- [UTILITIES.md](./UTILITIES.md) — `ExplainStep` type reference
- [QUERY_API.md](./QUERY_API.md) — operator reference
- [SEMANTICS.md](./SEMANTICS.md) — pipeline fusion semantics
