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

export const reduceFeature: FeaturePlugin = {
  name: 'Reduce',
  category: 'terminal',
  runSync(source, pipeline, seedOrFunc: any, func?: any) {
    let acc: any;
    let hasAcc = false;
    let startFunc = seedOrFunc;
    if (func !== undefined) {
      acc = seedOrFunc;
      hasAcc = true;
      startFunc = func;
    }
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      if (!hasAcc) {
        acc = item;
        hasAcc = true;
      } else {
        acc = startFunc(acc, item, index);
      }
      index++;
    }
    if (!hasAcc) throw new EmptySequenceError();
    return acc;
  },
  async runAsync(source, pipeline, seedOrFunc: any, func?: any) {
    const items = await collectToArray(source, pipeline);
    return reduceFeature.runSync!(items, emptyPipeline, seedOrFunc, func);
  },
  testCases: [
    {
      name: 'reduces elements with seed',
      source: [1, 2, 3],
      ops: [{ name: 'Reduce', args: [0, (acc: number, x: number) => acc + x] }],
      expected: 6,
    },
    {
      name: 'reduces elements without seed',
      source: [1, 2, 3],
      ops: [{ name: 'Reduce', args: [(acc: number, x: number) => acc + x] }],
      expected: 6,
    },
  ],
};
