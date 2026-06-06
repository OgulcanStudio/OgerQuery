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

export const orderByDescendingFeature: FeaturePlugin = {
  name: 'OrderByDescending',
  kind: 'orderBy',
  category: 'materializing',
  append(pipeline, keySelector: Selector<any, any>, options?: Omit<OrderByOptions, 'descending'>) {
    return orderByFeature.append!(pipeline, keySelector, { ...options, descending: true });
  },
  executeSync: orderByFeature.executeSync!,
  testCases: [
    {
      name: 'sorts elements in descending order',
      source: [3, 1, 2],
      ops: [{ name: 'OrderByDescending', args: [(x: number) => x] }],
      expected: [3, 2, 1],
    },
  ],
};
