import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { OpPipeline } from '../../core/OpPipeline.js';
import { executePipeline, executePipelineToLast } from '../../core/executor.js';
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

import { compareOrderKeys } from '../materializing/orderByHelpers.js';

export const lastFeature: FeaturePlugin = {
  name: 'Last',
  category: 'terminal',
  runSync(source, pipeline, predicate?: Predicate<any>) {
    return executePipelineToLast(source, pipeline.ops, predicate);
  },
  async runAsync(source, pipeline, predicate?: Predicate<any>) {
    const activeOps = predicate
      ? [...pipeline.ops, { kind: 'where' as const, predicate }]
      : pipeline.ops;
    const lenOps = activeOps.length;
    if (lenOps > 0 && activeOps[lenOps - 1]!.kind === 'orderBy') {
      const orderByOp = activeOps[lenOps - 1] as any;
      const precedingOps = activeOps.slice(0, lenOps - 1);
      const keys = orderByOp.keys;
      const numKeys = keys.length;
      let maxItem: any = null;
      let maxKeys: any[] = [];
      let hasAny = false;
      let index = 0;
      for await (const item of executeAsyncPipeline(source, { ops: precedingOps } as OpPipeline<any>)) {
        if (!hasAny) {
          maxItem = item;
          maxKeys = new Array(numKeys);
          for (let k = 0; k < numKeys; k++) {
            maxKeys[k] = keys[k]!.key(item, index);
          }
          hasAny = true;
        } else {
          const itemKeys = new Array(numKeys);
          for (let k = 0; k < numKeys; k++) {
            itemKeys[k] = keys[k]!.key(item, index);
          }
          let cmp = 0;
          for (let k = 0; k < numKeys; k++) {
            cmp = compareOrderKeys(itemKeys[k], maxKeys[k], keys[k]!);
            if (cmp !== 0) break;
          }
          if (cmp >= 0) {
            maxItem = item;
            maxKeys = itemKeys;
          }
        }
        index++;
      }
      if (!hasAny) throw new EmptySequenceError();
      return maxItem;
    }
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
