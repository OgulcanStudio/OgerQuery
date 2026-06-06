import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';

export const distinctByFeature: FeaturePlugin = {
  name: 'DistinctBy',
  kind: 'distinctBy',
  category: 'materializing',
  append(pipeline, keySelector: Selector<any, any>, comparer?: EqualityComparer<any>) {
    return pipeline.append({
      kind: 'distinctBy',
      keySelector,
      ...(comparer !== undefined ? { comparer } : {}),
    } as any);
  },
  *executeSync(source, op) {
    if (!op.comparer) {
      const seenKeys = new Set<any>();
      let index = 0;
      for (const item of source) {
        const key = op.keySelector(item, index);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          yield item;
        }
        index++;
      }
      return;
    }
    const keys: any[] = [];
    const eq = op.comparer;
    let index = 0;
    for (const item of source) {
      const key = op.keySelector(item, index);
      if (!keys.some((k) => eq(k, key))) {
        keys.push(key);
        yield item;
      }
      index++;
    }
  },
  testCases: [
    {
      name: 'returns unique elements by key selector',
      source: [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 1, name: 'c' },
      ],
      ops: [{ name: 'DistinctBy', args: [(x: any) => x.id] }],
      expected: [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
      ],
    },
    {
      name: 'distinctBy with custom comparer',
      source: [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 3, name: 'c' }
      ],
      ops: [
        {
          name: 'DistinctBy',
          args: [
            (x: any) => x.id,
            (a: number, b: number) => a % 2 === b % 2
          ]
        }
      ],
      expected: [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' }
      ]
    }
  ],
};
