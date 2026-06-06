import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';

export const unionFeature: FeaturePlugin = {
  name: 'Union',
  kind: 'union',
  category: 'materializing',
  append(pipeline, second: Iterable<any>, comparer?: EqualityComparer<any>) {
    return pipeline.append({
      kind: 'union',
      second,
      ...(comparer !== undefined ? { comparer } : {}),
    } as any);
  },
  *executeSync(source, op) {
    if (!op.comparer) {
      const seenSet = new Set<any>();
      for (const item of source) {
        if (!seenSet.has(item)) {
          seenSet.add(item);
          yield item;
        }
      }
      for (const item of op.second) {
        if (!seenSet.has(item)) {
          seenSet.add(item);
          yield item;
        }
      }
      return;
    }
    const eq = op.comparer;
    const seen: any[] = [];
    for (const item of source) {
      if (!seen.some((s) => eq(s, item))) {
        seen.push(item);
        yield item;
      }
    }
    for (const item of op.second) {
      if (!seen.some((s) => eq(s, item))) {
        seen.push(item);
        yield item;
      }
    }
  },
  testCases: [
    {
      name: 'performs set union',
      source: [1, 2, 2],
      ops: [{ name: 'Union', args: [[2, 3]] }],
      expected: [1, 2, 3],
    },
  ],
};
