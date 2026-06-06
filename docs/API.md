# OgerQuery API

The OgerQuery API module provides utilities for parsing query string parameters into typed filter predicates, security validation, and HTTP-friendly integration patterns.

## Query String Parsing

### `parseQueryString(query, options?)`

Parses URL query string parameters into a structured `ParsedQuery` object with filter, sort, pagination, and limit fields.

```ts
import { parseQueryString, type ParsedQuery } from "ogerquery";

const parsed = parseQueryString('?page=2&pageSize=10&limit=5&sort=-name&filter={"field":"age","op":"gt","value":30}');
// {
//   page: 2,
//   pageSize: 10,
//   limit: 5,
//   sort: '-name',
//   filter: { and: [{ field: 'age', op: 'gt', value: 30 }] }
// }
```

**`ParsedQuery` type:**
```ts
type ParsedQuery = {
  filter?: FilterGroup;
  sort?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
};
```

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `query` | `string` | URL query string (with or without leading `?`) |
| `options?` | `ApiSecurityOptions` | Security constraints (allowed fields, max depth, max limit) |

### `parseFilterJson(json, options?)`

Parses a raw JSON string into a `FilterGroup` structure with security sanitization applied.

```ts
const filter = parseFilterJson('{"field":"age","op":"gt","value":30}', {
  allowedFields: ['age', 'name']
});
```

### `predicateFromParsedQuery(parsed, options?)`

Converts a parsed query into a typed predicate function for use with `Q.Where()`.

```ts
const parsed = parseQueryString('?filter={"field":"id","op":"eq","value":1}');
const predicate = predicateFromParsedQuery<{ id: number }>(parsed);
// predicate({ id: 1 }) => true
// predicate({ id: 2 }) => false

let query = Q(data);
if (predicate) {
  query = query.Where(predicate);
}
```

## Security Utilities

### `ApiSecurityOptions`

```ts
type ApiSecurityOptions = {
  allowedFields?: readonly string[];  // Whitelist of filterable field names
  maxLimit?: number;                  // Maximum page limit (default: 1000)
  maxDepth?: number;                  // Maximum filter nesting depth (default: 5)
};
```

### `assertAllowedField(field, allowed?)`

Validates a field name against the allowed list and prevents prototype pollution.

```ts
assertAllowedField('email', ['name', 'email', 'age']); // OK
assertAllowedField('password', ['name', 'email', 'age']); // Throws
assertAllowedField('__proto__', ['name']); // Throws - unsafe key
```

### `clampLimit(limit, max?)`

Clamps a limit value to the valid range `[1, max]`.

```ts
clampLimit(50);        // 50
clampLimit(-10);       // 1
clampLimit(Infinity);  // 1
clampLimit(2000, 100); // 100
```

### `parsePositiveInt(raw)`

Safely parses a positive integer from a string. Returns `undefined` for invalid inputs.

```ts
parsePositiveInt('42');  // 42
parsePositiveInt('abc'); // undefined
parsePositiveInt('-1');  // undefined
```

### `assertMaxDepth(depth, max?)`

Enforces maximum nesting depth for filter groups to prevent deep recursion attacks.

```ts
assertMaxDepth(10, 5); // Throws: "Filter depth exceeds maximum"
```

### `sanitizeFilterObject(input, depth?, maxDepth?)`

Recursively removes unsafe property keys (`__proto__`, `constructor`, `prototype`) from a filter object.

```ts
const raw = {
  field: 'name',
  op: 'eq',
  constructor: {},
  nested: { field: 'age' },
};
sanitizeFilterObject(raw);
// { field: 'name', op: 'eq', nested: { field: 'age' } }
```

### `safeApiError(err)`

Normalizes thrown errors into safe user-facing messages (avoids leaking internals).

```ts
safeApiError(new Error('my error')); // "my error"
safeApiError('bad');                 // "Request failed"
```

## Full API Example

```ts
import { Q, parseQueryString, predicateFromParsedQuery } from "ogerquery";

function handleRequest(req: Request) {
  const parsed = parseQueryString(req.url, {
    allowedFields: ['name', 'email', 'age', 'status', 'amount'],
    maxLimit: 100,
    maxDepth: 5,
  });

  const predicate = predicateFromParsedQuery<Record<string, unknown>>(parsed);
  let query = Q(dataSource);

  if (predicate) query = query.Where(predicate);
  if (parsed.sort === '-name') query = query.OrderBy((x: any) => x.name);
  else if (parsed.sort === 'name') query = query.OrderBy((x: any) => x.name);

  const page = parsed.page ?? 1;
  const pageSize = parsed.pageSize ?? 20;
  return query.Paginate(page, pageSize);
}
```

## Outer Joins

Sync and async variants available:

| Operator | Description |
|----------|-------------|
| `LeftJoin(inner, outerKey, innerKey, resultSelector)` | Left outer join (null for missing inner) |
| `RightJoin(inner, outerKey, innerKey, resultSelector)` | Right outer join (null for missing outer) |
| `FullJoin(inner, outerKey, innerKey, resultSelector)` | Full outer join (null for either side) |

## Statistical Terminals

| Method | Description |
|--------|-------------|
| `Median(selector?)` | Median value (throws on empty) |
| `Mode(keySelector?)` | Most frequent value |
| `Percentile(p, selector?)` | p-th percentile (0-100) |
| `CountBy(keySelector)` | Frequency map per key |

## See Also

- [FILTERING.md](./FILTERING.md) — filter DSL and predicate builders
- [QUERY_API.md](./QUERY_API.md) — complete Query<T> operator reference
- [ERRORS.md](./ERRORS.md) — error classes thrown by terminals
