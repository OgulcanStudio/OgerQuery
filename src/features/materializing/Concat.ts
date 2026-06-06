import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';

export const concatFeature: FeaturePlugin = {
  name: 'Concat',
  kind: 'concat',
  category: 'materializing',
  append(pipeline, second: Iterable<any>) {
    return pipeline.append({ kind: 'concat', second });
  },
  *executeSync(source, op) {
    yield* source;
    yield* op.second;
  },
  testCases: [
    {
      name: 'concatenates two sequences',
      source: [1, 2],
      ops: [{ name: 'Concat', args: [[3, 4]] }],
      expected: [1, 2, 3, 4],
    },
  ],
};
