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
import { toDictionaryFeature } from './ToDictionary.js';

export const toObjectFeature: FeaturePlugin = {
  name: 'ToObject',
  category: 'terminal',
  runSync(source, pipeline, keySelector: Selector<any, any>, elementSelector?: Selector<any, any>) {
    const map = toDictionaryFeature.runSync!(source, pipeline, keySelector, elementSelector);
    return Object.fromEntries(map);
  },
  async runAsync(source, pipeline, keySelector: Selector<any, any>, elementSelector?: Selector<any, any>) {
    const map = await toDictionaryFeature.runAsync!(source, pipeline, keySelector, elementSelector);
    return Object.fromEntries(map);
  },
  testCases: [
    {
      name: 'materializes to object record',
      source: [{ k: 'a', v: 1 }],
      ops: [{ name: 'ToObject', args: [(x: any) => x.k, (x: any) => x.v] }],
      expected: { a: 1 },
    },
  ],
};
