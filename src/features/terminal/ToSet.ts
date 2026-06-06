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

export const toSetFeature: FeaturePlugin = {
  name: 'ToSet',
  category: 'terminal',
  runSync(source, pipeline) {
    return new Set(iterate(source, pipeline));
  },
  async runAsync(source, pipeline) {
    const items = await collectToArray(source, pipeline);
    return new Set(items);
  },
  testCases: [
    {
      name: 'materializes to Set',
      source: [1, 1, 2, 3],
      ops: [{ name: 'ToSet', args: [] }],
      expected: new Set([1, 2, 3]),
    },
  ],
};
