import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';

export const orderByFeature: FeaturePlugin = {
  name: 'OrderBy',
  kind: 'orderBy',
  category: 'materializing',
  append(pipeline, keySelector: Selector<any, any>, options: boolean | OrderByOptions = false) {
    const entry = toEntry(keySelector, options);
    const last = pipeline.last;
    if (last?.kind === 'orderBy') {
      return pipeline.replaceLast({
        kind: 'orderBy',
        keys: [...last.keys, entry],
      });
    }
    return pipeline.append({
      kind: 'orderBy',
      keys: [entry],
    });
  },
  executeSync(source, op) {
    const arr = [...source];
    stableSortInPlace(arr, op.keys);
    return arr;
  },
  testCases: [
    {
      name: 'sorts elements in ascending order',
      source: [3, 1, 2],
      ops: [{ name: 'OrderBy', args: [(x: number) => x] }],
      expected: [1, 2, 3],
    },
    {
      name: 'supports custom comparer',
      source: ['apple', 'banana', 'cherry'],
      ops: [
        {
          name: 'OrderBy',
          args: [
            (x: string) => x,
            { comparer: (a: string, b: string) => b.length - a.length },
          ],
        },
      ],
      expected: ['banana', 'cherry', 'apple'],
    },
    {
      name: 'supports localeCompare true',
      source: ['banana', 'apple', 'cherry'],
      ops: [
        {
          name: 'OrderBy',
          args: [
            (x: string) => x,
            { localeCompare: true },
          ],
        },
      ],
      expected: ['apple', 'banana', 'cherry'],
    },
    {
      name: 'supports localeCompare string',
      source: ['banana', 'apple', 'cherry'],
      ops: [
        {
          name: 'OrderBy',
          args: [
            (x: string) => x,
            { localeCompare: 'en' },
          ],
        },
      ],
      expected: ['apple', 'banana', 'cherry'],
    },
  ],
};
