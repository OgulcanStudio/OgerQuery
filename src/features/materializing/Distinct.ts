import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';

export const distinctFeature: FeaturePlugin = {
  name: 'Distinct',
  kind: 'distinct',
  category: 'materializing',
  append(pipeline, comparer?: EqualityComparer<any>) {
    return pipeline.append({
      kind: 'distinct',
      ...(comparer !== undefined ? { comparer } : {}),
    } as any);
  },
  *executeSync(source, op) {
    if (!op.comparer) {
      const seen = new Set<any>();
      for (const item of source) {
        if (!seen.has(item)) {
          seen.add(item);
          yield item;
        }
      }
      return;
    }
    const seen: any[] = [];
    const eq = op.comparer;
    for (const item of source) {
      if (!seen.some((s) => eq(s, item))) {
        seen.push(item);
        yield item;
      }
    }
  },
  testCases: [
    {
      name: 'returns unique elements',
      source: [1, 2, 2, 3, 1],
      ops: [{ name: 'Distinct', args: [] }],
      expected: [1, 2, 3],
    },
    {
      name: 'distinct with custom comparer',
      source: [1, 1, 2],
      ops: [{ name: 'Distinct', args: [(a: any, b: any) => a === b] }],
      expected: [1, 2]
    }
  ],
};
