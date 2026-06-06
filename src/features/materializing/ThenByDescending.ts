import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';
import { orderByFeature } from './OrderBy.js';

export const thenByDescendingFeature: FeaturePlugin = {
  name: 'ThenByDescending',
  kind: 'orderBy',
  category: 'materializing',
  append(pipeline, keySelector: Selector<any, any>, options?: Omit<OrderByOptions, 'descending'>) {
    return orderByFeature.append!(pipeline, keySelector, { ...options, descending: true });
  },
  executeSync: orderByFeature.executeSync!,
  testCases: [
    {
      name: 'subsequently sorts by thenBy key descending',
      source: [
        { a: 2, b: 5 },
        { a: 1, b: 20 },
        { a: 2, b: 10 },
      ],
      ops: [
        { name: 'OrderBy', args: [(x: any) => x.a] },
        { name: 'ThenByDescending', args: [(x: any) => x.b] },
      ],
      expected: [
        { a: 1, b: 20 },
        { a: 2, b: 10 },
        { a: 2, b: 5 },
      ],
    },
  ],
};
