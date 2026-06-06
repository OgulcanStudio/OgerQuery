# Filtering DSL

OgerQuery provides a composable predicate builder, path-based field predicates, JSON-serializable filter clauses, and API query parsing for dynamic filtering.

## Predicate Combinators

### `and(...predicates)`, `or(...predicates)`, `not(predicate)`

Combine multiple predicates with logical operators.

```ts
import { and, or, not, buildPredicate, fieldPredicate } from "ogerquery";

const isAdult = (u: User) => u.age >= 18;
const isAdmin = (u: User) => u.tags.includes("admin");

const adultAdmin = and(isAdult, isAdmin);
const adminOrSenior = or(isAdmin, (u) => u.age > 60);
const notAdmin = not(isAdmin);
```

### `Field Predicates (Path-Based)`

Apply filters to object properties using dot notation for nested paths.

```ts
import { fieldPredicate, predicates } from "ogerquery";

fieldPredicate("age", "gte", 18);
fieldPredicate("tags", "in", ["admin"]);
fieldPredicate("name", "startsWith", "A", { insensitive: true });
fieldPredicate("profile.address.city", "eq", "NYC");
```

### Direct predicate functions from `predicates` module:

```ts
import { predicates } from "ogerquery";

predicates.whereEq("age", 25);
predicates.whereGt("score", 100);
predicates.whereIn("role", ["admin", "moderator"]);
predicates.whereBetween("age", 18, 65);
predicates.whereContains("name", "ali", true);
predicates.whereStartsWith("email", "admin", false);
predicates.whereEndsWith("domain", ".com");
predicates.whereNull("deletedAt");
predicates.whereNotNull("email");
predicates.whereTruthy("active");
predicates.whereFalsy("suspended");
predicates.pluck("profile.name");
predicates.selectKeys(["id", "name"]);
predicates.omitKeys(["password"]);
```

## Filter Clauses (JSON-Serializable)

### `buildPredicate(group)`

Converts a declarative `FilterGroup` into a runtime predicate function.

```ts
import { buildPredicate, type FilterClause, type FilterGroup } from "ogerquery";

// Single clause
const clause: FilterClause = { field: "age", op: "gte", value: 18 };
const predicate = buildPredicate<User>(clause);

// Complex AND/OR/NOT group
const group: FilterGroup = {
  and: [
    { field: "active", op: "eq", value: true },
    { field: "age", op: "gte", value: 18 },
    { or: [
      { field: "role", op: "eq", value: "admin" },
      { field: "role", op: "eq", value: "moderator" },
    ]},
  ],
};

const complexPredicate = buildPredicate<User>(group);
```

### `FilterOperator`

| Operator | Alias | Description | Value Type |
|----------|-------|-------------|------------|
| `eq` | — | Equal | any |
| `ne` | — | Not equal | any |
| `gt` | — | Greater than | number/string/Date |
| `gte` | — | Greater than or equal | number/string/Date |
| `lt` | — | Less than | number/string/Date |
| `lte` | — | Less than or equal | number/string/Date |
| `in` | — | In array | any[] |
| `nin` | — | Not in array | any[] |
| `between` | — | Range (inclusive) | value, value2 |
| `contains` | — | String contains | string |
| `startsWith` | — | String starts with | string |
| `endsWith` | — | String ends with | string |
| `null` | — | Is null/undefined | — |
| `notNull` | — | Not null/undefined | — |

### `FilterGroup` type

```ts
type FilterGroup = {
  and?: (FilterClause | FilterGroup)[];
  or?: (FilterClause | FilterGroup)[];
  not?: FilterClause | FilterGroup;
};
```

### `predicateFromClause(clause)`

Converts a single `FilterClause` to a predicate directly.

```ts
const pred = predicateFromClause({ field: "age", op: "between", value: 18, value2: 65 });
```

## Query Helper Wrappers

Query and AsyncQuery expose object predicate methods:

```ts
Q(users)
  .WhereEq("profile.age", 30)
  .WhereGt("score", 100)
  .WhereIn("tags", ["typescript"])
  .WhereContains("name", "alice", true)  // case-insensitive
  .WhereNull("deletedAt")
  .WhereNotNull("email")
  .WhereTruthy("active")
  .SelectKeys(["id", "name"])
  .OmitKeys(["password"])
  .Pluck("profile.address.city")
  .ToArray();
```

## Schema Integration

### `validateFilterWithSchema(schema, input)`

Validates filter structure against an external schema validator (e.g., Zod).

```ts
import { validateFilterWithSchema, assertFilterShape } from "ogerquery";

const schema = {
  safeParse(input: unknown) {
    // implement validation
    return { success: true, data: input as FilterGroup };
  }
};

const validated = validateFilterWithSchema(schema, rawFilter);
```

### `assertFilterShape(group)`

Recursively validates a filter group for safe property access (no prototype pollution).

```ts
assertFilterShape({ and: [{ field: "id", op: "eq", value: 1 }] }); // OK
assertFilterShape({ and: [{ field: "__proto__", op: "eq", value: 1 }] }); // Throws
```

## Path Notation

Dot notation for nested properties is supported across all Where* helpers:

```ts
query.WhereEq("address.city", "NYC");
query.WhereGt("stats.score", 1000);
query.WhereBetween("profile.age", 18, 65);
```

Paths are validated via regex `/^[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*$/` to prevent prototype pollution.

## Integration with Q()

```ts
import { Q, parseQueryString, predicateFromParsedQuery } from "ogerquery";

function getUsers(req: Request) {
  const parsed = parseQueryString(req.url);
  const predicate = predicateFromParsedQuery<User>(parsed);

  let query = Q(allUsers);
  if (predicate) query = query.Where(predicate);

  if (parsed.sort) {
    const desc = parsed.sort.startsWith('-');
    const field = desc ? parsed.sort.slice(1) : parsed.sort;
    query = desc
      ? query.OrderByDescending((u: any) => u[field])
      : query.OrderBy((u: any) => u[field]);
  }

  return query
    .Skip((parsed.page! - 1) * parsed.pageSize!)
    .Take(parsed.pageSize!)
    .ToArray();
}
```

## Filter Composition

Predicates compose naturally with array methods and can be stored/serialized:

```ts
const filters: FilterGroup = {
  and: [
    { field: "status", op: "ne", value: "deleted" },
    {
      or: [
        { field: "role", op: "eq", value: "admin" },
        { field: "permissions", op: "contains", value: "read" },
      ],
    },
  ],
};

// Store as JSON
const json = JSON.stringify(filters);

// Restore and apply
const predicate = buildPredicate<User>(JSON.parse(json));
const results = Q(users).Where(predicate).ToArray();
```

## See Also

- [API.md](./API.md) — query string parsing and security
- [QUERY_API.md](./QUERY_API.md) — complete operator reference
- [ERRORS.md](./ERRORS.md) — error types
