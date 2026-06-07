import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { OpPipeline } from '../../core/OpPipeline.js';
import { executePipeline, executePipelineToFirst } from '../../core/executor.js';
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

export const firstFeature: FeaturePlugin = {
  name: 'First',
  category: 'terminal',
  runSync(source, pipeline, predicate?: Predicate<any>) {
    return executePipelineToFirst(source, pipeline.ops, predicate);
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
      let minItem: any = null;
      let minKeys: any[] = [];
      let hasAny = false;
      let index = 0;
      for await (const item of executeAsyncPipeline(source, { ops: precedingOps } as OpPipeline<any>)) {
        if (!hasAny) {
          minItem = item;
          minKeys = new Array(numKeys);
          for (let k = 0; k < numKeys; k++) {
            minKeys[k] = keys[k]!.key(item, index);
          }
          hasAny = true;
        } else {
          const itemKeys = new Array(numKeys);
          for (let k = 0; k < numKeys; k++) {
            itemKeys[k] = keys[k]!.key(item, index);
          }
          let cmp = 0;
          for (let k = 0; k < numKeys; k++) {
            cmp = compareOrderKeys(itemKeys[k], minKeys[k], keys[k]!);
            if (cmp !== 0) break;
          }
          if (cmp < 0) {
            minItem = item;
            minKeys = itemKeys;
          }
        }
        index++;
      }
      if (!hasAny) throw new EmptySequenceError();
      return minItem;
    }
    let index = 0;
    for await (const item of executeAsyncPipeline(source, pipeline)) {
      if (!predicate || predicate(item, index)) return item;
      index++;
    }
    throw new EmptySequenceError();
  },
  testCases: [
    {
      name: 'returns first element',
      source: [1, 2, 3],
      ops: [{ name: 'First', args: [] }],
      expected: 1,
    },
    {
      name: 'returns first element matching predicate',
      source: [1, 2, 3],
      ops: [{ name: 'First', args: [(x: number) => x > 1] }],
      expected: 2,
    },
    {
      name: 'throws EmptySequenceError if sequence is empty',
      source: [],
      ops: [{ name: 'First', args: [] }],
      error: EmptySequenceError,
    },
  ],
};
