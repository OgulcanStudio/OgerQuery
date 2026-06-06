import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { OpPipeline } from '../../core/OpPipeline.js';
import { executePipeline, executePipelineToArray } from '../../core/executor.js';
import { executeAsyncPipeline } from '../../core/asyncExecutor.js';
import { isArray } from '../../utils/isArray.js';
import { canUseArrayFastPath } from '../../core/pipelineOps.js';
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

export const toArrayFeature: FeaturePlugin = {
  name: 'ToArray',
  category: 'terminal',
  runSync(source, pipeline) {
    return executePipelineToArray(source, pipeline.ops);
  },

  runAsync(source, pipeline) {
    return collectToArray(source, pipeline);
  },
  testCases: [
    {
      name: 'materializes sequence to array',
      source: [1, 2, 3],
      ops: [{ name: 'ToArray', args: [] }],
      expected: [1, 2, 3],
    },
  ],
};
