import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';

export const groupByFeature: FeaturePlugin = {
  name: 'GroupBy',
  kind: 'groupBy',
  category: 'materializing',
  append(pipeline, keySelector: Selector<any, any>, elementSelector?: Selector<any, any>) {
    return pipeline.append({
      kind: 'groupBy',
      keySelector,
      ...(elementSelector !== undefined ? { elementSelector } : {}),
    });
  },
  *executeSync(source, op) {
    const map = new Map<any, any[]>();
    let index = 0;
    for (const item of source) {
      const key = op.keySelector(item, index);
      const element = op.elementSelector ? op.elementSelector(item, index) : item;
      const bucket = map.get(key);
      if (bucket) bucket.push(element);
      else map.set(key, [element]);
      index++;
    }
    for (const [key, elements] of map) {
      yield new Grouping(key, elements);
    }
  },
  testCases: [
    {
      name: 'groups elements by key',
      source: [
        { key: 'A', val: 1 },
        { key: 'B', val: 2 },
        { key: 'A', val: 3 },
      ],
      ops: [{ name: 'GroupBy', args: [(x: any) => x.key] }],
      expected: [
        { key: 'A', elements: [{ key: 'A', val: 1 }, { key: 'A', val: 3 }] },
        { key: 'B', elements: [{ key: 'B', val: 2 }] },
      ],
    },
    {
      name: 'groups elements with element selector',
      source: [
        { key: 'A', val: 1 },
        { key: 'B', val: 2 },
        { key: 'A', val: 3 },
      ],
      ops: [{ name: 'GroupBy', args: [(x: any) => x.key, (x: any) => x.val] }],
      expected: [
        { key: 'A', elements: [1, 3] },
        { key: 'B', elements: [2] }
      ]
    }
  ],
};
