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

export const minByFeature: FeaturePlugin = {
  name: 'MinBy',
  category: 'terminal',
  runSync(source, pipeline, keySelector: Selector<any, any>) {
    let best: any;
    let bestKey: any;
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      const key = keySelector(item, index);
      if (
        best === undefined ||
        compareWith(key, bestKey, defaultComparer as (a: any, b: any) => number) < 0
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
    return minByFeature.runSync!(items, emptyPipeline, keySelector);
  },
  testCases: [
    {
      name: 'finds element with minimum key',
      source: [{ v: 2 }, { v: 1 }, { v: 3 }],
      ops: [{ name: 'MinBy', args: [selectV] }],
      expected: { v: 1 },
    },
    {
      name: 'MinBy throws EmptySequenceError when empty',
      source: [],
      ops: [{ name: 'MinBy', args: [selectV] }],
      error: EmptySequenceError
    }
  ],
};
