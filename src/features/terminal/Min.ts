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

export const minFeature: FeaturePlugin = {
  name: 'Min',
  category: 'terminal',
  runSync(source, pipeline, selector?: Selector<any, number>) {
    let min: number | undefined;
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      const value = selector ? selector(item, index) : (item as number);
      if (min === undefined || value < min) min = value;
      index++;
    }
    if (min === undefined) throw new EmptySequenceError();
    return min;
  },
  async runAsync(source, pipeline, selector?: Selector<any, number>) {
    const items = await collectToArray(source, pipeline);
    return minFeature.runSync!(items, emptyPipeline, selector);
  },
  testCases: [
    {
      name: 'finds minimum value',
      source: [2, 1, 3],
      ops: [{ name: 'Min', args: [] }],
      expected: 1,
    },
    {
      name: 'throws if empty',
      source: [],
      ops: [{ name: 'Min', args: [] }],
      error: EmptySequenceError,
    },
  ],
};
