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

export const toMapFeature: FeaturePlugin = {
  name: 'ToMap',
  category: 'terminal',
  runSync(source, pipeline, keySelector: Selector<any, any>, elementSelector?: Selector<any, any>) {
    return toDictionaryFeature.runSync!(source, pipeline, keySelector, elementSelector);
  },
  runAsync(source, pipeline, keySelector: Selector<any, any>, elementSelector?: Selector<any, any>) {
    return toDictionaryFeature.runAsync!(source, pipeline, keySelector, elementSelector);
  },
  testCases: [
    {
      name: 'materializes to Map',
      source: [{ k: 'a', v: 1 }],
      ops: [{ name: 'ToMap', args: [(x: any) => x.k, (x: any) => x.v] }],
      expected: new Map([['a', 1]]),
    },
  ],
};
