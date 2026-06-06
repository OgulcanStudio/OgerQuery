import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { OpPipeline } from '../../core/OpPipeline.js';
import { executePipeline } from '../../core/executor.js';
import { executeAsyncPipeline } from '../../core/asyncExecutor.js';
import {
  EmptySequenceError,
  MoreThanOneElementError,
  ArgumentOutOfRangeError,
  Grouping,
  Lookup,
  type Predicate,
  type Selector,
  type EqualityComparer,
} from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { clampPageSize, createPageResult, type PageResult, type CursorPageResult } from '../../pagination/types.js';
import { iterate, collectToArray, emptyPipeline } from './terminalHelpers.js';
import { toArrayFeature } from './ToArray.js';

export const paginateFeature: FeaturePlugin = {
  name: 'Paginate',
  category: 'terminal',
  runSync(source, pipeline, page: number, pageSize: number, maxPageSize?: number) {
    const size = clampPageSize(pageSize, maxPageSize);
    const validPage = Math.max(1, Math.floor(page) || 1);
    const all = toArrayFeature.runSync!(source, pipeline);
    const skip = (validPage - 1) * size;
    const items = all.slice(skip, skip + size);
    return createPageResult(items, validPage, size, all.length);
  },
  async runAsync(source, pipeline, page: number, pageSize: number, maxPageSize?: number) {
    const items = await collectToArray(source, pipeline);
    return paginateFeature.runSync!(items, emptyPipeline, page, pageSize, maxPageSize);
  },
  testCases: [
    {
      name: 'paginates sequence results',
      source: [1, 2, 3, 4, 5],
      ops: [{ name: 'Paginate', args: [2, 2] }],
      expected: {
        items: [3, 4],
        page: 2,
        pageSize: 2,
        total: 5,
        totalPages: 3,
        hasNext: true,
        hasPrevious: true,
      },
    },
    {
      name: 'paginates sequence results with invalid page',
      source: [1, 2, 3, 4, 5],
      ops: [{ name: 'Paginate', args: [0, 2] }],
      expected: {
        items: [1, 2],
        page: 1,
        pageSize: 2,
        total: 5,
        totalPages: 3,
        hasNext: true,
        hasPrevious: false,
      },
    },
  ],
};
