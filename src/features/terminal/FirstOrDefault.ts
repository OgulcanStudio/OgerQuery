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
import { firstFeature } from './First.js';

const badIterable = {
  [Symbol.iterator]() {
    throw new TypeError('boom');
  }
} as any;

export const firstOrDefaultFeature: FeaturePlugin = {
  name: 'FirstOrDefault',
  category: 'terminal',
  runSync(source, pipeline, defaultValue: any, predicate?: Predicate<any>) {
    try {
      return firstFeature.runSync!(source, pipeline, predicate);
    } catch (e) {
      if (e instanceof EmptySequenceError) return defaultValue;
      throw e;
    }
  },
  async runAsync(source, pipeline, defaultValue: any, predicate?: Predicate<any>) {
    try {
      return await firstFeature.runAsync!(source, pipeline, predicate);
    } catch (e) {
      if (e instanceof EmptySequenceError) return defaultValue;
      throw e;
    }
  },
  testCases: [
    {
      name: 'returns first element if present',
      source: [1, 2],
      ops: [{ name: 'FirstOrDefault', args: [99] }],
      expected: 1,
    },
    {
      name: 'returns default value if empty',
      source: [],
      ops: [{ name: 'FirstOrDefault', args: [99] }],
      expected: 99,
    },
    {
      name: 'FirstOrDefault propagates foreign errors',
      source: badIterable,
      ops: [
        {
          name: 'FirstOrDefault',
          args: [0]
        }
      ],
      error: 'boom'
    }
  ],
};
