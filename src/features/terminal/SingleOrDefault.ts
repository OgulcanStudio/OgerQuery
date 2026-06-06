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

export const singleOrDefaultFeature: FeaturePlugin = {
  name: 'SingleOrDefault',
  category: 'terminal',
  runSync(source, pipeline, defaultValue: any, predicate?: Predicate<any>) {
    let result: any;
    let count = 0;
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      if (!predicate || predicate(item, index)) {
        if (count > 0) throw new MoreThanOneElementError();
        result = item;
        count++;
      }
      index++;
    }
    return count === 0 ? defaultValue : result;
  },
  async runAsync(source, pipeline, defaultValue: any, predicate?: Predicate<any>) {
    const items = await collectToArray(source, pipeline);
    return singleOrDefaultFeature.runSync!(items, emptyPipeline, defaultValue, predicate);
  },
  testCases: [
    {
      name: 'returns default if empty',
      source: [],
      ops: [{ name: 'SingleOrDefault', args: [99] }],
      expected: 99,
    },
    {
      name: 'returns single element',
      source: [42],
      ops: [{ name: 'SingleOrDefault', args: [99] }],
      expected: 42,
    },
    {
      name: 'throws if more than one',
      source: [1, 2],
      ops: [{ name: 'SingleOrDefault', args: [99] }],
      error: MoreThanOneElementError,
    },
    {
      name: 'returns matching element',
      source: [1, 2, 3],
      ops: [{ name: 'SingleOrDefault', args: [99, (x: number) => x === 2] }],
      expected: 2,
    },
    {
      name: 'returns default if none match',
      source: [1, 2, 3],
      ops: [{ name: 'SingleOrDefault', args: [99, (x: number) => x === 4] }],
      expected: 99,
    },
    {
      name: 'throws if more than one match',
      source: [1, 2, 3],
      ops: [{ name: 'SingleOrDefault', args: [99, (x: number) => x > 1] }],
      error: MoreThanOneElementError,
    },
  ],
};
