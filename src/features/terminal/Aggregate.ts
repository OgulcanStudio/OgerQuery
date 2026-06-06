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

export const aggregateFeature: FeaturePlugin = {
  name: 'Aggregate',
  category: 'terminal',
  runSync(source, pipeline, seed: any, func: (acc: any, item: any, index: number) => any) {
    let acc = seed;
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      acc = func(acc, item, index);
      index++;
    }
    return acc;
  },
  async runAsync(source, pipeline, seed: any, func: (acc: any, item: any, index: number) => any) {
    const items = await collectToArray(source, pipeline);
    return aggregateFeature.runSync!(items, emptyPipeline, seed, func);
  },
  testCases: [
    {
      name: 'aggregates with seed',
      source: [1, 2, 3],
      ops: [{ name: 'Aggregate', args: [0, (acc: number, x: number) => acc + x] }],
      expected: 6,
    },
  ],
};
