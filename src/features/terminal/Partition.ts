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

export const partitionFeature: FeaturePlugin = {
  name: 'Partition',
  category: 'terminal',
  runSync(source, pipeline, predicate: Predicate<any>) {
    const matches: any[] = [];
    const rest: any[] = [];
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      if (predicate(item, index)) matches.push(item);
      else rest.push(item);
      index++;
    }
    return [matches, rest];
  },
  async runAsync(source, pipeline, predicate: Predicate<any>) {
    const items = await collectToArray(source, pipeline);
    return partitionFeature.runSync!(items, emptyPipeline, predicate);
  },
  testCases: [
    {
      name: 'partitions sequence',
      source: [1, 2, 3, 4],
      ops: [{ name: 'Partition', args: [(x: number) => x % 2 === 0] }],
      expected: [[2, 4], [1, 3]],
    },
  ],
};
