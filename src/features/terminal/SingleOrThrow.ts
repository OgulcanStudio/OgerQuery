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
import { singleFeature } from './Single.js';

export const singleOrThrowFeature: FeaturePlugin = {
  name: 'SingleOrThrow',
  category: 'terminal',
  runSync(source, pipeline, predicate?: Predicate<any>) {
    return singleFeature.runSync!(source, pipeline, predicate);
  },
  runAsync(source, pipeline, predicate?: Predicate<any>) {
    return singleFeature.runAsync!(source, pipeline, predicate);
  },
  testCases: [
    {
      name: 'returns single element',
      source: [42],
      ops: [{ name: 'SingleOrThrow', args: [] }],
      expected: 42,
    },
  ],
};
