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
import { toArrayFeature } from './ToArray.js';

export const toListFeature: FeaturePlugin = {
  name: 'ToList',
  category: 'terminal',
  runSync(source, pipeline) {
    return toArrayFeature.runSync!(source, pipeline);
  },
  runAsync(source, pipeline) {
    return toArrayFeature.runAsync!(source, pipeline);
  },
  testCases: [
    {
      name: 'materializes sequence to list',
      source: [1, 2, 3],
      ops: [{ name: 'ToList', args: [] }],
      expected: [1, 2, 3],
    },
  ],
};
