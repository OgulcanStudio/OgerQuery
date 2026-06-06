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

export const sequenceEqualFeature: FeaturePlugin = {
  name: 'SequenceEqual',
  category: 'terminal',
  runSync(source, pipeline, second: Iterable<any>, comparer?: EqualityComparer<any>) {
    const eq = comparer ?? (Object.is as EqualityComparer<any>);
    const iter1 = iterate(source, pipeline)[Symbol.iterator]();
    const iter2 = second[Symbol.iterator]();
    while (true) {
      const a = iter1.next();
      const b = iter2.next();
      if (a.done && b.done) return true;
      if (a.done !== b.done) return false;
      if (!eq(a.value, b.value)) return false;
    }
  },
  async runAsync(source, pipeline, second: AsyncIterable<any> | Iterable<any>, comparer?: EqualityComparer<any>) {
    const items = await collectToArray(source, pipeline);
    let secondItems: any[];
    if (Symbol.asyncIterator in Object(second)) {
      secondItems = [];
      for await (const x of second as AsyncIterable<any>) {
        secondItems.push(x);
      }
    } else {
      secondItems = [...(second as Iterable<any>)];
    }
    return sequenceEqualFeature.runSync!(items, emptyPipeline, secondItems, comparer);
  },
  testCases: [
    {
      name: 'compares two sequences',
      source: [1, 2, 3],
      ops: [{ name: 'SequenceEqual', args: [[1, 2, 3]] }],
      expected: true,
    },
    {
      name: 'SequenceEqual returns false if sequences have different lengths',
      source: [1, 2],
      ops: [{ name: 'SequenceEqual', args: [[1, 2, 3]] }],
      expected: false
    },
    {
      name: 'SequenceEqual returns false if sequences have same length but different values',
      source: [1, 2],
      ops: [{ name: 'SequenceEqual', args: [[1, 99]] }],
      expected: false
    },
    {
      name: 'SequenceEqual uses custom comparer',
      source: [1, 2],
      ops: [{ name: 'SequenceEqual', args: [[1, 2], (a: any, b: any) => a === b] }],
      expected: true
    }
  ],
};
