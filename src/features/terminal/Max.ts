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

export const maxFeature: FeaturePlugin = {
  name: 'Max',
  category: 'terminal',
  runSync(source, pipeline, selector?: Selector<any, number>) {
    let max: number | undefined;
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      const value = selector ? selector(item, index) : (item as number);
      if (max === undefined || value > max) max = value;
      index++;
    }
    if (max === undefined) throw new EmptySequenceError();
    return max;
  },
  async runAsync(source, pipeline, selector?: Selector<any, number>) {
    const items = await collectToArray(source, pipeline);
    return maxFeature.runSync!(items, emptyPipeline, selector);
  },
  testCases: [
    {
      name: 'finds maximum value',
      source: [2, 3, 1],
      ops: [{ name: 'Max', args: [] }],
      expected: 3,
    },
  ],
};
