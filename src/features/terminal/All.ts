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

const isEven = (x: number) => x % 2 === 0;

export const allFeature: FeaturePlugin = {
  name: 'All',
  category: 'terminal',
  runSync(source, pipeline, predicate: Predicate<any>) {
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      if (!predicate(item, index)) return false;
      index++;
    }
    return true;
  },
  async runAsync(source, pipeline, predicate: Predicate<any>) {
    let index = 0;
    for await (const item of executeAsyncPipeline(source, pipeline)) {
      if (!predicate(item, index)) return false;
      index++;
    }
    return true;
  },
  testCases: [
    {
      name: 'checks if all elements match',
      source: [2, 4, 6],
      ops: [{ name: 'All', args: [isEven] }],
      expected: true,
    },
    {
      name: 'checks if all elements match returning false',
      source: [2, 3, 4],
      ops: [{ name: 'All', args: [isEven] }],
      expected: false,
    },
    {
      name: 'All returns true for empty sequence',
      source: [],
      ops: [{ name: 'All', args: [isEven] }],
      expected: true
    }
  ],
};
