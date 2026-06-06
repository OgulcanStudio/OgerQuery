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

export const countByFeature: FeaturePlugin = {
  name: 'CountBy',
  category: 'terminal',
  runSync(source, pipeline, keySelector: Selector<any, any>) {
    const map = new Map<any, number>();
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      const key = keySelector(item, index);
      map.set(key, (map.get(key) ?? 0) + 1);
      index++;
    }
    return map;
  },
  async runAsync(source, pipeline, keySelector: Selector<any, any>) {
    const items = await collectToArray(source, pipeline);
    return countByFeature.runSync!(items, emptyPipeline, keySelector);
  },
  testCases: [
    {
      name: 'counts occurrences by key',
      source: [1, 1, 2],
      ops: [{ name: 'CountBy', args: [(x: number) => x] }],
      expected: new Map([[1, 2], [2, 1]]),
    },
  ],
};
