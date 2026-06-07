import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { OpPipeline } from '../../core/OpPipeline.js';
import { executePipeline, executePipelineToAny } from '../../core/executor.js';
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

export const anyFeature: FeaturePlugin = {
  name: 'Any',
  category: 'terminal',
  runSync(source, pipeline, predicate?: Predicate<any>) {
    return executePipelineToAny(source, pipeline.ops, predicate);
  },
  async runAsync(source, pipeline, predicate?: Predicate<any>) {
    let index = 0;
    for await (const item of executeAsyncPipeline(source, pipeline)) {
      if (!predicate || predicate(item, index)) return true;
      index++;
    }
    return false;
  },
  testCases: [
    {
      name: 'checks if any element matches',
      source: [1, 2, 3],
      ops: [{ name: 'Any', args: [(x: number) => x > 2] }],
      expected: true,
    },
    {
      name: 'returns false if empty',
      source: [],
      ops: [{ name: 'Any', args: [] }],
      expected: false,
    },
    {
      name: 'Any matches based on value and index',
      source: [1, 2, 3],
      ops: [{ name: 'Any', args: [(x: number, i: number) => i === 2 && x === 3] }],
      expected: true
    }
  ],
};
