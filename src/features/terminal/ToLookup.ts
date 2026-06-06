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

export const toLookupFeature: FeaturePlugin = {
  name: 'ToLookup',
  category: 'terminal',
  runSync(source, pipeline, keySelector: Selector<any, any>, elementSelector?: Selector<any, any>) {
    const map = new Map<any, any[]>();
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      const key = keySelector(item, index);
      const element = elementSelector ? elementSelector(item, index) : item;
      const bucket = map.get(key);
      if (bucket) bucket.push(element);
      else map.set(key, [element]);
      index++;
    }
    return new Lookup(map);
  },
  async runAsync(source, pipeline, keySelector: Selector<any, any>, elementSelector?: Selector<any, any>) {
    const items = await collectToArray(source, pipeline);
    return toLookupFeature.runSync!(items, emptyPipeline, keySelector, elementSelector);
  },
  testCases: [
    {
      name: 'materializes sequence to Lookup',
      source: [
        { key: 'a', val: 1 },
        { key: 'b', val: 2 },
        { key: 'a', val: 3 },
      ],
      ops: [{ name: 'ToLookup', args: [(x: any) => x.key] }],
      expected: [
        { key: 'a', elements: [ { key: 'a', val: 1 }, { key: 'a', val: 3 } ] },
        { key: 'b', elements: [ { key: 'b', val: 2 } ] },
      ],
    },
    {
      name: 'toLookup with key and element selectors',
      source: [
        { id: 1, email: 'a' },
        { id: 1, email: 'b' }
      ],
      ops: [
        {
          name: 'ToLookup',
          args: [
            (x: any) => x.id,
            (x: any) => x.email
          ]
        }
      ],
      expected: [
        { key: 1, elements: ['a', 'b'] }
      ]
    }
  ],
};
