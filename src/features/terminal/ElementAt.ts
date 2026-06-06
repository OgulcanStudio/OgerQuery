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

export const elementAtFeature: FeaturePlugin = {
  name: 'ElementAt',
  category: 'terminal',
  runSync(source, pipeline, index: number) {
    if (index < 0) throw new ArgumentOutOfRangeError();
    let i = 0;
    for (const item of iterate(source, pipeline)) {
      if (i === index) return item;
      i++;
    }
    throw new ArgumentOutOfRangeError();
  },
  async runAsync(source, pipeline, index: number) {
    const items = await collectToArray(source, pipeline);
    return elementAtFeature.runSync!(items, emptyPipeline, index);
  },
  testCases: [
    {
      name: 'gets element at index',
      source: [10, 20, 30],
      ops: [{ name: 'ElementAt', args: [1] }],
      expected: 20,
    },
    {
      name: 'throws out of range',
      source: [10],
      ops: [{ name: 'ElementAt', args: [5] }],
      error: ArgumentOutOfRangeError,
    },
    {
      name: 'ElementAt negative index throws ArgumentOutOfRangeError',
      source: [1, 2],
      ops: [{ name: 'ElementAt', args: [-1] }],
      error: ArgumentOutOfRangeError
    }
  ],
};
