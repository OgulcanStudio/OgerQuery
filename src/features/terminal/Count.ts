import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { OpPipeline } from '../../core/OpPipeline.js';
import { executePipeline, executePipelineToCount } from '../../core/executor.js';
import { executeAsyncPipeline } from '../../core/asyncExecutor.js';
import { isArray } from '../../utils/isArray.js';
import { canUseArrayFastPath } from '../../core/pipelineOps.js';
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

export const countFeature: FeaturePlugin = {
  name: 'Count',
  category: 'terminal',
  runSync(source, pipeline, predicate?: Predicate<any>) {
    return executePipelineToCount(source, pipeline.ops, predicate);
  },
  async runAsync(source, pipeline, predicate?: Predicate<any>) {
    if (!predicate) {
      let count = 0;
      for await (const _ of executeAsyncPipeline(source, pipeline)) {
        count++;
      }
      return count;
    }
    const items = await collectToArray(source, pipeline);
    return countFeature.runSync!(items, emptyPipeline, predicate);
  },
  testCases: [
    {
      name: 'counts elements',
      source: [1, 2, 3],
      ops: [{ name: 'Count', args: [] }],
      expected: 3,
    },
    {
      name: 'counts elements with predicate',
      source: [1, 2, 3, 4],
      ops: [{ name: 'Count', args: [(x: number) => x % 2 === 0] }],
      expected: 2,
    },
  ],
};
