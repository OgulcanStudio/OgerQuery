import type { Predicate } from '../core/types.js';
import { filterFieldRoot, getByPath, isSafePropertyKey } from '../utils/path.js';
import * as predicates from '../helpers/predicates.js';

export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'between'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'null'
  | 'notNull';

export type FilterClause = {
  field: string;
  op: FilterOperator;
  value?: unknown;
  value2?: unknown;
  insensitive?: boolean;
};

export function and<T>(...parts: Predicate<T>[]): Predicate<T> {
  return (item, index) => parts.every((p) => p(item, index));
}

export function or<T>(...parts: Predicate<T>[]): Predicate<T> {
  return (item, index) => parts.some((p) => p(item, index));
}

export function not<T>(predicate: Predicate<T>): Predicate<T> {
  return (item, index) => !predicate(item, index);
}

export function predicateFromClause<T>(clause: FilterClause): Predicate<T> {
  if (!isSafePropertyKey(filterFieldRoot(clause.field))) {
    throw new Error('Unsafe filter field');
  }
  const path = clause.field;
  switch (clause.op) {
    case 'eq':
      return predicates.whereEq(path, clause.value);
    case 'ne':
      return predicates.whereNotEq(path, clause.value);
    case 'gt':
      return predicates.whereGt(path, clause.value as number);
    case 'gte':
      return predicates.whereGte(path, clause.value as number);
    case 'lt':
      return predicates.whereLt(path, clause.value as number);
    case 'lte':
      return predicates.whereLte(path, clause.value as number);
    case 'in':
      return predicates.whereIn(path, (clause.value as unknown[]) ?? []);
    case 'nin':
      return predicates.whereNotIn(path, (clause.value as unknown[]) ?? []);
    case 'between':
      return predicates.whereBetween(
        path,
        clause.value as number,
        clause.value2 as number,
      );
    case 'contains':
      return predicates.whereContains(path, String(clause.value ?? ''), clause.insensitive);
    case 'startsWith':
      return predicates.whereStartsWith(path, String(clause.value ?? ''), clause.insensitive);
    case 'endsWith':
      return predicates.whereEndsWith(path, String(clause.value ?? ''), clause.insensitive);
    case 'null':
      return predicates.whereNull(path);
    case 'notNull':
      return predicates.whereNotNull(path);
    default:
      throw new Error(`Unknown filter operator: ${clause.op as string}`);
  }
}

export type FilterGroup = {
  and?: (FilterClause | FilterGroup)[];
  or?: (FilterClause | FilterGroup)[];
  not?: FilterClause | FilterGroup;
};

export function buildPredicate<T>(group: FilterGroup): Predicate<T> {
  if (group.not) {
    const inner =
      'op' in group.not
        ? predicateFromClause(group.not as FilterClause)
        : buildPredicate(group.not as FilterGroup);
    return not(inner);
  }
  if (group.and?.length) {
    return and(
      ...group.and.map((entry) =>
        'op' in entry ? predicateFromClause(entry as FilterClause) : buildPredicate(entry as FilterGroup),
      ),
    );
  }
  if (group.or?.length) {
    return or(
      ...group.or.map((entry) =>
        'op' in entry ? predicateFromClause(entry as FilterClause) : buildPredicate(entry as FilterGroup),
      ),
    );
  }
  return () => true;
}

export function fieldPredicate<T>(
  field: string,
  op: FilterOperator,
  value?: unknown,
  options?: { insensitive?: boolean; value2?: unknown },
): Predicate<T> {
  const clause: FilterClause = { field, op, value };
  if (options?.value2 !== undefined) clause.value2 = options.value2;
  if (options?.insensitive !== undefined) clause.insensitive = options.insensitive;
  return predicateFromClause(clause);
}

export function pathPredicate<T>(path: string, op: FilterOperator, value?: unknown): Predicate<T> {
  return fieldPredicate(path, op, value);
}

export function getPathValue<T>(item: T, path: string): unknown {
  return getByPath(item, path);
}
