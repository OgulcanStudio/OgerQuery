import './features/registry.js';

export {
  Q,
  QAsync,
  Empty,
  Range,
  Repeat,
  From,
  FromAsync,
  EmptyAsync,
  pipe,
  pipeAsync,
} from './core/Q.js';
export type { QuerySource, AsyncQuerySource } from './core/Q.js';
export { Query } from './core/Query.js';
export { AsyncQuery } from './core/AsyncQuery.js';
export {
  EmptySequenceError,
  MoreThanOneElementError,
  ArgumentOutOfRangeError,
  InvalidOperationError,
  Grouping,
  Lookup,
} from './core/types.js';
export type {
  Predicate,
  Selector,
  Comparer,
  EqualityComparer,
  OrderKey,
  IGrouping,
  Indexed,
  Pair,
} from './core/types.js';
export type { OrderByOptions } from './features/materializing/orderByHelpers.js';
export type { NullSortStrategy } from './core/pipelineOps.js';
export type { PageResult, CursorPageResult } from './pagination/types.js';
export { DEFAULT_MAX_PAGE_SIZE, createPageResult, clampPageSize } from './pagination/types.js';
export {
  and,
  or,
  not,
  buildPredicate,
  fieldPredicate,
  predicateFromClause,
  type FilterClause,
  type FilterGroup,
  type FilterOperator,
} from './filter/filterBuilder.js';
export * as predicates from './helpers/predicates.js';
export {
  parseQueryString,
  parseFilterJson,
  predicateFromParsedQuery,
  safeApiError,
  type ParsedQuery,
} from './api/parseQuery.js';
export {
  assertAllowedField,
  assertMaxDepth,
  clampLimit,
  parsePositiveInt,
  sanitizeFilterObject,
  type ApiSecurityOptions,
} from './api/security.js';
export {
  explainPipeline,
  explainPipelineText,
  setDebugMode,
  isDebugMode,
  debugLog,
  type ExplainStep,
} from './debug/explain.js';
export { some, None, ok, err, fromNullable, tryRun, tryRunSync, type Option, type Result } from './result/option.js';
export { fromReadableStream, toReadableStream } from './streams/adapters.js';
export { validateFilterWithSchema, assertFilterShape } from './schema/schemaFilter.js';
