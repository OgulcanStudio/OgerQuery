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

export const medianFeature: FeaturePlugin = {
  name: 'Median',
  category: 'terminal',
  runSync(source, pipeline, selector?: Selector<any, number>) {
    const values: number[] = [];
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      values.push(selector ? selector(item, index) : (item as number));
      index++;
    }
    if (values.length === 0) throw new EmptySequenceError();
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0 ? (values[mid - 1]! + values[mid]!) / 2 : values[mid]!;
  },
  async runAsync(source, pipeline, selector?: Selector<any, number>) {
    const items = await collectToArray(source, pipeline);
    return medianFeature.runSync!(items, emptyPipeline, selector);
  },
  testCases: [
    {
      name: 'finds median of even length sequence',
      source: [1, 2, 3, 4],
      ops: [{ name: 'Median', args: [] }],
      expected: 2.5,
    },
    {
      name: 'finds median with selector',
      source: [{ val: 1 }, { val: 3 }, { val: 2 }],
      ops: [{ name: 'Median', args: [(x: any) => x.val] }],
      expected: 2,
    },
  ],
};
