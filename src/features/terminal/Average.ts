import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { OpPipeline } from '../../core/OpPipeline.js';
import { executePipeline, executePipelineToAverage } from '../../core/executor.js';
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
import { kahanAdd, kahanTotal } from '../../utils/kahanSum.js';

export const averageFeature: FeaturePlugin = {
  name: 'Average',
  category: 'terminal',
  runSync(source, pipeline, selector?: Selector<any, number>) {
    return executePipelineToAverage(source, pipeline.ops, selector);
  },
  async runAsync(source, pipeline, selector?: Selector<any, number>) {
    const items = await collectToArray(source, pipeline);
    return averageFeature.runSync!(items, emptyPipeline, selector);
  },
  testCases: [
    {
      name: 'averages numbers',
      source: [1, 2, 3],
      ops: [{ name: 'Average', args: [] }],
      expected: 2,
    },
  ],
};
