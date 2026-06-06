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

export const toDictionaryFeature: FeaturePlugin = {
  name: 'ToDictionary',
  category: 'terminal',
  runSync(source, pipeline, keySelector: Selector<any, any>, elementSelector?: Selector<any, any>) {
    const map = new Map<any, any>();
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      const key = keySelector(item, index);
      const element = elementSelector ? elementSelector(item, index) : item;
      if (map.has(key)) {
        throw new Error('An element with the same key already exists');
      }
      map.set(key, element);
      index++;
    }
    return map;
  },
  async runAsync(source, pipeline, keySelector: Selector<any, any>, elementSelector?: Selector<any, any>) {
    const items = await collectToArray(source, pipeline);
    return toDictionaryFeature.runSync!(items, emptyPipeline, keySelector, elementSelector);
  },
  testCases: [
    {
      name: 'materializes to dictionary map',
      source: [{ k: 'a', v: 1 }, { k: 'b', v: 2 }],
      ops: [
        {
          name: 'ToDictionary',
          args: [
            (x: any) => x.k,
            (x: any) => x.v,
          ],
        },
      ],
      expected: new Map([['a', 1], ['b', 2]]),
    },
    {
      name: 'throws if key duplicated',
      source: [{ k: 'a', v: 1 }, { k: 'a', v: 2 }],
      ops: [{ name: 'ToDictionary', args: [(x: any) => x.k] }],
      error: 'already exists',
    },
  ],
};
