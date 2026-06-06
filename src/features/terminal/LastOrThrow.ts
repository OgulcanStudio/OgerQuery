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

export const lastOrThrowFeature: FeaturePlugin = {
  name: 'LastOrThrow',
  category: 'terminal',
  runSync(source, pipeline, predicate?: Predicate<any>) {
    return lastFeature.runSync!(source, pipeline, predicate);
  },
  runAsync(source, pipeline, predicate?: Predicate<any>) {
    return lastFeature.runAsync!(source, pipeline, predicate);
  },
  testCases: [
    {
      name: 'returns last element',
      source: [5, 6],
      ops: [{ name: 'LastOrThrow', args: [] }],
      expected: 6,
    },
  ],
};
