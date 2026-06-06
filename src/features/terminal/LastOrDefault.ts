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
import { lastFeature } from './Last.js';

const badIterable = {
  [Symbol.iterator]() {
    throw new TypeError('boom');
  }
} as any;

export const lastOrDefaultFeature: FeaturePlugin = {
  name: 'LastOrDefault',
  category: 'terminal',
  runSync(source, pipeline, defaultValue: any, predicate?: Predicate<any>) {
    try {
      return lastFeature.runSync!(source, pipeline, predicate);
    } catch (e) {
      if (e instanceof EmptySequenceError) return defaultValue;
      throw e;
    }
  },
  async runAsync(source, pipeline, defaultValue: any, predicate?: Predicate<any>) {
    try {
      return await lastFeature.runAsync!(source, pipeline, predicate);
    } catch (e) {
      if (e instanceof EmptySequenceError) return defaultValue;
      throw e;
    }
  },
  testCases: [
    {
      name: 'returns default if empty',
      source: [],
      ops: [{ name: 'LastOrDefault', args: [99] }],
      expected: 99,
    },
    {
      name: 'LastOrDefault propagates foreign errors',
      source: badIterable,
      ops: [
        {
          name: 'LastOrDefault',
          args: [0]
        }
      ],
      error: 'boom'
    }
  ],
};
