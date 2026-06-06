import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';

export const reverseFeature: FeaturePlugin = {
  name: 'Reverse',
  kind: 'reverse',
  category: 'materializing',
  append(pipeline) {
    return pipeline.append({ kind: 'reverse' });
  },
  executeSync(source) {
    return [...source].reverse();
  },
  testCases: [
    {
      name: 'reverses order of elements',
      source: [1, 2, 3],
      ops: [{ name: 'Reverse', args: [] }],
      expected: [3, 2, 1],
    },
  ],
};
