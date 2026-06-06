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

const selectV = (x: any) => x.v;

export const maxByFeature: FeaturePlugin = {
  name: 'MaxBy',
  category: 'terminal',
  runSync(source, pipeline, keySelector: Selector<any, any>) {
    let best: any;
    let bestKey: any;
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      const key = keySelector(item, index);
      if (
        best === undefined ||
        compareWith(key, bestKey, defaultComparer as (a: any, b: any) => number) > 0
      ) {
        best = item;
        bestKey = key;
      }
      index++;
    }
    if (best === undefined) throw new EmptySequenceError();
    return best;
  },
  async runAsync(source, pipeline, keySelector: Selector<any, any>) {
    const items = await collectToArray(source, pipeline);
    return maxByFeature.runSync!(items, emptyPipeline, keySelector);
  },
  testCases: [
    {
      name: 'finds element with maximum key',
      source: [{ v: 2 }, { v: 3 }, { v: 1 }],
      ops: [{ name: 'MaxBy', args: [selectV] }],
      expected: { v: 3 },
    },
    {
      name: 'MaxBy throws EmptySequenceError when empty',
      source: [],
      ops: [{ name: 'MaxBy', args: [selectV] }],
      error: EmptySequenceError
    }
  ],
};
