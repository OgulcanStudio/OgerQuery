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

export const elementAtOrDefaultFeature: FeaturePlugin = {
  name: 'ElementAtOrDefault',
  category: 'terminal',
  runSync(source, pipeline, index: number, defaultValue: any) {
    if (index < 0) return defaultValue;
    let i = 0;
    for (const item of iterate(source, pipeline)) {
      if (i === index) return item;
      i++;
    }
    return defaultValue;
  },
  async runAsync(source, pipeline, index: number, defaultValue: any) {
    const items = await collectToArray(source, pipeline);
    return elementAtOrDefaultFeature.runSync!(items, emptyPipeline, index, defaultValue);
  },
  testCases: [
    {
      name: 'returns default if index out of range',
      source: [10],
      ops: [{ name: 'ElementAtOrDefault', args: [5, 99] }],
      expected: 99,
    },
    {
      name: 'ElementAtOrDefault negative index returns default',
      source: [1, 2],
      ops: [{ name: 'ElementAtOrDefault', args: [-1, 99] }],
      expected: 99
    }
  ],
};
