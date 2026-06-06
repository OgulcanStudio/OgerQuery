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
import { kahanAdd, kahanTotal } from '../../utils/kahanSum.js';

export const averageFeature: FeaturePlugin = {
  name: 'Average',
  category: 'terminal',
  runSync(source, pipeline, selector?: Selector<any, number>) {
    const acc = { sum: 0, compensation: 0 };
    let count = 0;
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      kahanAdd(acc, selector ? selector(item, index) : (item as number));
      count++;
      index++;
    }
    if (count === 0) throw new EmptySequenceError();
    return kahanTotal(acc) / count;
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
