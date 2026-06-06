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

export const splitAtFeature: FeaturePlugin = {
  name: 'SplitAt',
  category: 'terminal',
  runSync(source, pipeline, index: number) {
    if (index < 0) throw new RangeError('index must be non-negative');
    const before: any[] = [];
    const after: any[] = [];
    let i = 0;
    for (const item of iterate(source, pipeline)) {
      if (i < index) before.push(item);
      else after.push(item);
      i++;
    }
    return [before, after];
  },
  async runAsync(source, pipeline, index: number) {
    const items = await collectToArray(source, pipeline);
    return splitAtFeature.runSync!(items, emptyPipeline, index);
  },
  testCases: [
    {
      name: 'splits sequence at index',
      source: [1, 2, 3, 4],
      ops: [{ name: 'SplitAt', args: [2] }],
      expected: [[1, 2], [3, 4]],
    },
    {
      name: 'negative index throws RangeError',
      source: [1, 2],
      ops: [{ name: 'SplitAt', args: [-1] }],
      error: RangeError,
    },
  ],
};
