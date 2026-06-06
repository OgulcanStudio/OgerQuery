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

export const cursorPageFeature: FeaturePlugin = {
  name: 'CursorPage',
  category: 'terminal',
  runSync(source, pipeline, pageSize: number, cursor?: string, maxPageSize?: number) {
    const size = clampPageSize(pageSize, maxPageSize);
    const start = cursor ? Math.max(0, parseInt(cursor, 10) || 0) : 0;
    const all = toArrayFeature.runSync!(source, pipeline);
    const items = all.slice(start, start + size);
    const nextIndex = start + size;
    const hasNext = nextIndex < all.length;
    return {
      items,
      nextCursor: hasNext ? String(nextIndex) : null,
      hasNext,
    };
  },
  async runAsync(source, pipeline, pageSize: number, cursor?: string, maxPageSize?: number) {
    const items = await collectToArray(source, pipeline);
    return cursorPageFeature.runSync!(items, emptyPipeline, pageSize, cursor, maxPageSize);
  },
  testCases: [
    {
      name: 'cursor-paginates results',
      source: [1, 2, 3],
      ops: [{ name: 'CursorPage', args: [2] }],
      expected: {
        items: [1, 2],
        nextCursor: '2',
        hasNext: true,
      },
    },
    {
      name: 'cursor-paginates results with cursor',
      source: [1, 2, 3],
      ops: [{ name: 'CursorPage', args: [2, '1'] }],
      expected: {
        items: [2, 3],
        nextCursor: null,
        hasNext: false,
      },
    },
  ],
};
