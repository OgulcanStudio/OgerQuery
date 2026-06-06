# Stream Adapters

OgerQuery provides Web Streams API interop for converting between `ReadableStream` and `AsyncIterable`, enabling seamless streaming pipelines with backpressure support.

## `fromReadableStream(stream)`

Converts a `ReadableStream<T>` to an `AsyncIterable<T>` for use with `QAsync`.

```ts
import { fromReadableStream, QAsync } from "ogerquery";

const response = await fetch("https://api.example.com/data");
const lines = QAsync(fromReadableStream(response.body!))
  .Select((chunk) => new TextDecoder().decode(chunk))
  .SelectMany((text) => text.split("\n"))
  .Where((line) => line.trim().length > 0)
  .ToArrayAsync();
```

**Signature:**
```ts
function fromReadableStream<T>(stream: ReadableStream<T>): AsyncIterable<T>
```

The adapter acquires a reader via `stream.getReader()`, yields chunks via `reader.read()`, and releases the lock in a `finally` block when iteration completes or is interrupted.

## `toReadableStream(source)`

Converts an `AsyncIterable<T>` to a `ReadableStream<T>`.

```ts
import { toReadableStream, QAsync } from "ogerquery";

async function* generateData() {
  for (let i = 0; i < 100; i++) {
    yield JSON.stringify({ id: i, data: "x".repeat(100) }) + "\n";
    await new Promise((r) => setTimeout(r, 10));
  }
}

const stream = toReadableStream(generateData());

return new Response(stream, {
  headers: { "content-type": "application/x-ndjson" },
});
```

**Signature:**
```ts
function toReadableStream<T>(source: AsyncIterable<T>): ReadableStream<T>
```

The adapter creates a `ReadableStream` with `pull()` that reads from the async iterator and `cancel()` that calls `iterator.return()` for cleanup.

## NDJSON Streaming Pipeline

Server-side streaming with query transformations:

```ts
import { QAsync, toReadableStream } from "ogerquery";

async function handleExport(): Promise<Response> {
  const stream = toReadableStream(
    QAsync(database.cursor())
      .Where((row) => row.active)
      .Select((row) => JSON.stringify(row)),
  );

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson" },
  });
}
```

Client-side consumption:

```ts
const response = await fetch("/export");
const processed = await QAsync(fromReadableStream(response.body!))
  .Select((chunk) => new TextDecoder().decode(chunk))
  .SelectMany((text) => text.trim().split("\n"))
  .Select((line) => JSON.parse(line))
  .Where((row) => row.active)
  .ToArrayAsync();
```

## Streaming Pipeline Pattern

Chaining input/output adapters for full streaming:

```ts
async function processStream(input: ReadableStream<Uint8Array>): Promise<ReadableStream<Uint8Array>> {
  return toReadableStream(
    QAsync(fromReadableStream(input))
      .Select((chunk) => parseChunk(chunk))
      .Where((record) => record.valid)
      .Select((record) => transform(record)),
  );
}
```

## Backpressure

Both adapters respect backpressure:
- **`fromReadableStream`**: The `ReadableStream` internal buffer controls flow; slow consumers cause the stream reader to pause.
- **`toReadableStream`**: Uses the Web Streams underlying source `pull()` model, which naturally applies backpressure when the consumer reads slower than the producer.

## Error Handling

Errors in the source async iterable propagate to the `ReadableStream`:

```ts
const stream = toReadableStream(
  (async function* () {
    for await (const item of source) {
      if (isInvalid(item)) throw new Error("Invalid item");
      yield process(item);
    }
  })()
);

// Consumer handles errors
const reader = stream.getReader();
try {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
  }
} catch (err) {
  console.error("Stream error:", err);
}
```

## Cancellation

`toReadableStream` supports cancellation: calling `stream.cancel()` triggers `iterator.return()` on the source async iterator for proper cleanup.

```ts
const stream = toReadableStream(source);
await stream.cancel(); // triggers iterator.return()
```

## Binary Data Passthrough

For binary streams where encoding is not needed:

```ts
const binaryStream = toReadableStream(
  async function* () {
    for await (const chunk of binarySource) {
      yield chunk; // Uint8Array
    }
  }(),
);
```

## Integration with Standard Endpoints

Returning `ReadableStream` directly in web-standard HTTP environments:

```ts
async function handleStream(): Promise<Response> {
  const stream = toReadableStream(
    QAsync(dataSource())
      .Select((row) => JSON.stringify(row))
  );

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson",
      "transfer-encoding": "chunked",
    },
  });
}
```

## See Also

- [INTEGRATION.md](./INTEGRATION.md) — async data source patterns
- [QUERY_API.md](./QUERY_API.md) — operator reference for streaming queries
- [SEMANTICS.md](./SEMANTICS.md) — lazy evaluation semantics
