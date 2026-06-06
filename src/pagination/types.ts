export const DEFAULT_MAX_PAGE_SIZE = 1000;

export interface PageResult<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}

export interface CursorPageResult<T, TCursor = string> {
  readonly items: readonly T[];
  readonly nextCursor: TCursor | null;
  readonly hasNext: boolean;
}

export function createPageResult<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
): PageResult<T> {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

export function clampPageSize(pageSize: number, maxPageSize = DEFAULT_MAX_PAGE_SIZE): number {
  if (pageSize < 1) return 1;
  return Math.min(pageSize, maxPageSize);
}
