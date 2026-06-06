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
import { countFeature } from './Count.js';

export const longCountFeature: FeaturePlugin = {
  name: 'LongCount',
  category: 'terminal',
  runSync(source, pipeline) {
    return countFeature.runSync!(source, pipeline);
  },
  runAsync(source, pipeline) {
    return countFeature.runAsync!(source, pipeline);
  },
  testCases: [
    {
      name: 'counts elements long',
      source: [1, 2, 3],
      ops: [{ name: 'LongCount', args: [] }],
      expected: 3,
    },
  ],
};
