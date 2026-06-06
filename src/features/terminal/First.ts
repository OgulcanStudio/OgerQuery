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

export const firstFeature: FeaturePlugin = {
  name: 'First',
  category: 'terminal',
  runSync(source, pipeline, predicate?: Predicate<any>) {
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      if (!predicate || predicate(item, index)) return item;
      index++;
    }
    throw new EmptySequenceError();
  },
  async runAsync(source, pipeline, predicate?: Predicate<any>) {
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
