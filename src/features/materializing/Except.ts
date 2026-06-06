import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';

export const exceptFeature: FeaturePlugin = {
  name: 'Except',
  kind: 'except',
  category: 'materializing',
  append(pipeline, second: Iterable<any>, comparer?: EqualityComparer<any>) {
    return pipeline.append({
      kind: 'except',
      second,
      ...(comparer !== undefined ? { comparer } : {}),
    } as any);
  },
  *executeSync(source, op) {
    if (!op.comparer) {
      const secondSet = new Set(op.second);
      for (const item of source) {
        if (!secondSet.has(item)) {
          yield item;
        }
      }
      return;
    }
    const eq = op.comparer;
    const secondItems = [...op.second];
    for (const item of source) {
      if (!secondItems.some((s) => eq(s, item))) {
        yield item;
      }
    }
  },
  testCases: [
    {
      name: 'performs set difference',
      source: [1, 2, 3],
      ops: [{ name: 'Except', args: [[2]] }],
      expected: [1, 3],
    },
  ],
};
