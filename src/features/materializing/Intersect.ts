import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';

export const intersectFeature: FeaturePlugin = {
  name: 'Intersect',
  kind: 'intersect',
  category: 'materializing',
  append(pipeline, second: Iterable<any>, comparer?: EqualityComparer<any>) {
    return pipeline.append({
      kind: 'intersect',
      second,
      ...(comparer !== undefined ? { comparer } : {}),
    } as any);
  },
  *executeSync(source, op) {
    if (!op.comparer) {
      const secondSet = new Set(op.second);
      const yieldedSet = new Set<any>();
      for (const item of source) {
        if (secondSet.has(item) && !yieldedSet.has(item)) {
          yieldedSet.add(item);
          yield item;
        }
      }
      return;
    }
    const eq = op.comparer;
    const secondItems = [...op.second];
    const yielded: any[] = [];
    for (const item of source) {
      if (secondItems.some((s) => eq(s, item)) && !yielded.some((y) => eq(y, item))) {
        yielded.push(item);
        yield item;
      }
    }
  },
  testCases: [
    {
      name: 'performs set intersection',
      source: [1, 2, 3],
      ops: [{ name: 'Intersect', args: [[2, 4]] }],
      expected: [2],
    },
  ],
};
