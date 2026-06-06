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

export const lastFeature: FeaturePlugin = {
  name: 'Last',
  category: 'terminal',
  runSync(source, pipeline, predicate?: Predicate<any>) {
    let found: any;
    let has = false;
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      if (!predicate || predicate(item, index)) {
        found = item;
        has = true;
      }
      index++;
    }
    if (!has) throw new EmptySequenceError();
    return found;
  },
  async runAsync(source, pipeline, predicate?: Predicate<any>) {
    const items = await collectToArray(source, pipeline);
    return lastFeature.runSync!(items, emptyPipeline, predicate);
  },
  testCases: [
    {
      name: 'returns last element',
      source: [1, 2, 3],
      ops: [{ name: 'Last', args: [] }],
      expected: 3,
    },
    {
      name: 'throws if empty',
      source: [],
      ops: [{ name: 'Last', args: [] }],
      error: EmptySequenceError,
    },
    {
      name: 'Last with predicate matching items',
      source: [
        { name: 'Josh', active: true },
        { name: 'Amy', active: false },
        { name: 'Josh', active: true }
      ],
      ops: [{ name: 'Last', args: [(u: any) => u.active] }],
      expected: { name: 'Josh', active: true }
    },
    {
      name: 'Last throws EmptySequenceError when no matches',
      source: [],
      ops: [{ name: 'Last', args: [] }],
      error: EmptySequenceError
    }
  ],
};
