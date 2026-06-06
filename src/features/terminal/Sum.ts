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
import { executePipelineToSum } from '../../core/executor.js';
import { kahanAdd, kahanTotal } from '../../utils/kahanSum.js';

export const sumFeature: FeaturePlugin = {
  name: 'Sum',
  category: 'terminal',
  runSync(source, pipeline, selector?: Selector<any, number>) {
    return executePipelineToSum(source, pipeline.ops, selector);
  },
  async runAsync(source, pipeline, selector?: Selector<any, number>) {
    const items = await collectToArray(source, pipeline);
    return sumFeature.runSync!(items, emptyPipeline, selector);
  },
  testCases: [
    {
      name: 'sums numbers',
      source: [1, 2, 3],
      ops: [{ name: 'Sum', args: [] }],
      expected: 6,
    },
  ],
};
