import { buildPredicate, type FilterClause, type FilterGroup } from '../filter/filterBuilder.js';
import type { Predicate } from '../core/types.js';
import {
  assertAllowedField,
  assertMaxDepth,
  clampLimit,
  DEFAULT_API_MAX_DEPTH,
  parsePositiveInt,
  sanitizeFilterObject,
  type ApiSecurityOptions,
  safeApiError,
} from './security.js';

export type ParsedQuery = {
  filter?: FilterGroup;
  sort?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
};

export function parseQueryString(
  query: string,
  options?: ApiSecurityOptions,
): ParsedQuery {
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  const parsed: ParsedQuery = {};
  const page = params.get('page');
  const pageSize = params.get('pageSize') ?? params.get('page_size');
  const limit = params.get('limit');
  const sort = params.get('sort');
  const filterRaw = params.get('filter');

  if (page) {
    const p = parsePositiveInt(page);
    if (p !== undefined) parsed.page = p;
  }
  if (pageSize) {
    const ps = parsePositiveInt(pageSize);
    if (ps !== undefined) parsed.pageSize = ps;
  }
  if (limit) parsed.limit = clampLimit(Number(limit), options?.maxLimit);
  if (sort) parsed.sort = sort;

  if (filterRaw) {
    parsed.filter = parseFilterJson(filterRaw, options);
  }
  return parsed;
}

export function parseFilterJson(
  json: string,
  options?: ApiSecurityOptions,
): FilterGroup {
  const raw = JSON.parse(json) as Record<string, unknown>;
  const safe = sanitizeFilterObject(raw);
  return normalizeFilterGroup(safe, options, 0);
}

function normalizeFilterGroup(
  raw: Record<string, unknown>,
  options: ApiSecurityOptions | undefined,
  depth: number,
): FilterGroup {
  assertMaxDepth(depth, options?.maxDepth ?? DEFAULT_API_MAX_DEPTH);
  if (raw.and) {
    return {
      and: (raw.and as unknown[]).map((entry) =>
        normalizeEntry(entry, options, depth + 1),
      ),
    };
  }
  if (raw.or) {
    return {
      or: (raw.or as unknown[]).map((entry) =>
        normalizeEntry(entry, options, depth + 1),
      ),
    };
  }
  if (raw.not) {
    return { not: normalizeEntry(raw.not, options, depth + 1) };
  }
  if (raw.field && raw.op) {
    const clause = raw as unknown as FilterClause;
    assertAllowedField(clause.field, options?.allowedFields);
    return { and: [clause] };
  }
  return { and: [] };
}

function normalizeEntry(
  entry: unknown,
  options: ApiSecurityOptions | undefined,
  depth: number,
): FilterClause | FilterGroup {
  if (entry && typeof entry === 'object' && 'field' in entry && 'op' in entry) {
    const clause = entry as FilterClause;
    assertAllowedField(clause.field, options?.allowedFields);
    return clause;
  }
  return normalizeFilterGroup(entry as Record<string, unknown>, options, depth);
}

export function predicateFromParsedQuery<T>(
  parsed: ParsedQuery,
  options?: ApiSecurityOptions,
): Predicate<T> | undefined {
  if (!parsed.filter) return undefined;
  void options;
  return buildPredicate<T>(parsed.filter);
}

export { safeApiError };
