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

export const percentileFeature: FeaturePlugin = {
  name: 'Percentile',
  category: 'terminal',
  runSync(source, pipeline, percentile: number, selector?: Selector<any, number>) {
    if (percentile < 0 || percentile > 100) throw new ArgumentOutOfRangeError('percentile must be 0–100');
    const values: number[] = [];
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      values.push(selector ? selector(item, index) : (item as number));
      index++;
    }
    if (values.length === 0) throw new EmptySequenceError();
    values.sort((a, b) => a - b);
    const rank = (percentile / 100) * (values.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    if (lower === upper) return values[lower]!;
    const weight = rank - lower;
    return values[lower]! * (1 - weight) + values[upper]! * weight;
  },
  async runAsync(source, pipeline, percentile: number, selector?: Selector<any, number>) {
    const items = await collectToArray(source, pipeline);
    return percentileFeature.runSync!(items, emptyPipeline, percentile, selector);
  },
  testCases: [
    {
      name: 'calculates percentile value',
      source: [1, 2, 3, 4],
      ops: [{ name: 'Percentile', args: [50] }],
      expected: 2.5,
    },
    {
      name: 'calculates percentile with selector and exact match',
      source: [{ val: 1 }, { val: 2 }, { val: 3 }],
      ops: [{ name: 'Percentile', args: [100, (x: any) => x.val] }],
      expected: 3,
    },
  ],
};
