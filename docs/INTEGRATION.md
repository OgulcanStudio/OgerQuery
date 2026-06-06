# Framework Integration

OgerQuery has **no runtime coupling** to any runtime or server library. Import `Q` / `QAsync` and run queries on any in-memory `Iterable` or `AsyncIterable` you already have.

## Package Entry

```ts
import { Q, QAsync, pipe, pipeAsync } from "ogerquery";
```

Tree-shakeable ESM/CJS builds; zero production dependencies.

## Node.js / Bun / Deno

```ts
import { Q } from "ogerquery";
import { readFile } from "node:fs/promises";

const ids = Q((await readFile("ids.txt", "utf8")).split("\n"))
  .Where((line) => line.length > 0)
  .Select(Number)
  .ToArray();
```

Bun uses the same import path; no `node:` polyfills required.

## Browser

Works with arrays, `NodeList`, generators, or any `Iterable`:

```ts
import { Q } from "ogerquery";

const labels = Q(document.querySelectorAll(".tag"))
  .Select((el) => el.textContent ?? "")
  .Where((t) => t.length > 0)
  .ToArray();
```

## HTTP Route Handlers

Use queries inside standard route handlers on data from databases, caches, or request parsing:

```ts
import { Q } from "ogerquery";

async function handleGetUsers(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const skip = Number(url.searchParams.get("skip") ?? "0");
  const take = Number(url.searchParams.get("take") ?? "20");

  const page = Q(db.getUsers())
    .Where((u) => u.active)
    .OrderBy((u) => u.name)
    .Skip(skip)
    .Take(take)
    .ToArray();

  return Response.json(page);
}
```

## Async Data Sources

For `fetch`, streams, or ORMs exposing `AsyncIterable`:

```ts
import { QAsync, FromAsync } from "ogerquery";

const rows = await FromAsync(streamRows())
  .Where((r) => r.valid)
  .ToArrayAsync();
```

## API Query Parsing Integration

Parse query strings from HTTP requests into typed filters:

```ts
import { Q, parseQueryString, predicateFromParsedQuery } from "ogerquery";

function getUsers(req: Request) {
  const parsed = parseQueryString(req.url, {
    allowedFields: ["name", "email", "age", "role"],
    maxLimit: 100,
  });
  const predicate = predicateFromParsedQuery<User>(parsed);

  let query = Q(allUsers);
  if (predicate) query = query.Where(predicate);
  if (parsed.sort === "-name") query = query.OrderByDescending((u) => u.name);

  return query.Paginate(parsed.page ?? 1, parsed.pageSize ?? 20);
}
```

## Node.js Streams

OgerQuery provides Web Streams adapters. Use `fromReadableStream` / `toReadableStream` for streaming pipelines:

```ts
import { QAsync, fromReadableStream, toReadableStream } from "ogerquery";

async function processStream(input: ReadableStream<Uint8Array>) {
  return toReadableStream(
    QAsync(fromReadableStream(input))
      .Select(parseChunk)
      .Where((r) => r.valid)
      .Select(transform),
  );
}
```

See [STREAM_ADAPTERS.md](./STREAM_ADAPTERS.md) for full streaming reference.

## Database Integration (Conceptual)

OgerQuery operates on in-memory data. Load from your database first:

```ts
import { Q } from "ogerquery";

// Prisma
const users = await prisma.user.findMany();
const result = Q(users)
  .Where((u) => u.active)
  .OrderBy((u) => u.name)
  .ToArray();

// SQL
const rows = await sql`SELECT * FROM orders WHERE status != 'cancelled'`;
const total = Q(rows).Sum((r) => r.amount);

// MongoDB
const docs = await collection.find({}).toArray();
const grouped = Q(docs).GroupBy((d) => d.category).ToArray();
```

## Composition Helpers

### `pipe(source, transform)`

Runs a transform function on a `Query<T>` and returns the result:

```ts
import { pipe, type QuerySource } from "ogerquery";

const ids: QuerySource<number> = [1, 2, 3] as const;
const evens = pipe(ids, (q) => q.Where((n) => n % 2 === 0).ToArray());
```

### `pipeAsync(source, transform)`

Same pattern for async queries:

```ts
import { pipeAsync } from "ogerquery";

const result = await pipeAsync(asyncSource, (q) =>
  q.Where((r) => r.valid).ToArrayAsync()
);
```

## Compatibility with Array Methods

OgerQuery operators work alongside native Array methods:

```ts
const data = [1, 2, 3, 4, 5];

// Mix and match
const result = Q(data)
  .Where((n) => n > 2)
  .ToArray()
  .map((n) => n * 10);  // native Array.map
```

`Q()` wraps any `Iterable<T>`, including `ReadonlyArray<T>`, `Set<T>`, `Map<K,V>`, generators, and custom iterables.

## Summary

| Environment | Import | Adapter Needed |
|-------------|--------|----------------|
| Node.js | `ogerquery` | No |
| Bun | `ogerquery` | No |
| Deno | `ogerquery` | No |
| Browser (ESM) | `ogerquery` | No |
| React/Next.js | `ogerquery` | No |
| Cloudflare Workers | `ogerquery` | No |

## See Also

- [STREAM_ADAPTERS.md](./STREAM_ADAPTERS.md) — ReadableStream interop
- [API.md](./API.md) — query string parsing
- [QUERY_API.md](./QUERY_API.md) — operator reference
- [SEMANTICS.md](./SEMANTICS.md) — lazy vs materializing behavior
