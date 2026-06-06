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

export const firstOrThrowFeature: FeaturePlugin = {
  name: 'FirstOrThrow',
  category: 'terminal',
  runSync(source, pipeline, predicate?: Predicate<any>) {
    return firstFeature.runSync!(source, pipeline, predicate);
  },
  runAsync(source, pipeline, predicate?: Predicate<any>) {
    return firstFeature.runAsync!(source, pipeline, predicate);
  },
  testCases: [
    {
      name: 'returns first element',
      source: [5, 6],
      ops: [{ name: 'FirstOrThrow', args: [] }],
      expected: 5,
    },
  ],
};
