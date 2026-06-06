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

export const containsFeature: FeaturePlugin = {
  name: 'Contains',
  category: 'terminal',
  runSync(source, pipeline, value: any, comparer?: EqualityComparer<any>) {
    const eq = comparer ?? (Object.is as EqualityComparer<any>);
    for (const item of iterate(source, pipeline)) {
      if (eq(item, value)) return true;
    }
    return false;
  },
  async runAsync(source, pipeline, value: any, comparer?: EqualityComparer<any>) {
    const items = await collectToArray(source, pipeline);
    return containsFeature.runSync!(items, emptyPipeline, value, comparer);
  },
  testCases: [
    {
      name: 'checks if sequence contains value',
      source: [1, 2, 3],
      ops: [{ name: 'Contains', args: [2] }],
      expected: true,
    },
    {
      name: 'Contains uses custom comparer',
      source: [{ id: 1 }, { id: 2 }],
      ops: [
        {
          name: 'Contains',
          args: [
            { id: 1 },
            (a: any, b: any) => a.id === b.id
          ]
        }
      ],
      expected: true
    }
  ],
};
