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

export const singleFeature: FeaturePlugin = {
  name: 'Single',
  category: 'terminal',
  runSync(source, pipeline, predicate?: Predicate<any>) {
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
    if (count === 0) throw new EmptySequenceError();
    return result;
  },
  async runAsync(source, pipeline, predicate?: Predicate<any>) {
    const items = await collectToArray(source, pipeline);
    return singleFeature.runSync!(items, emptyPipeline, predicate);
  },
  testCases: [
    {
      name: 'returns single element',
      source: [42],
      ops: [{ name: 'Single', args: [] }],
      expected: 42,
    },
    {
      name: 'throws if more than one',
      source: [1, 2],
      ops: [{ name: 'Single', args: [] }],
      error: MoreThanOneElementError,
    },
  ],
};
