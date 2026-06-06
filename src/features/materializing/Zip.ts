import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';

export const zipFeature: FeaturePlugin = {
  name: 'Zip',
  kind: 'zip',
  category: 'materializing',
  append(pipeline, second: Iterable<any>, resultSelector: (first: any, second: any) => any) {
    return pipeline.append({ kind: 'zip', second, resultSelector });
  },
  *executeSync(source, op) {
    const iter1 = source[Symbol.iterator]();
    const iter2 = op.second[Symbol.iterator]();
    while (true) {
      const a = iter1.next();
      const b = iter2.next();
      if (a.done || b.done) return;
      yield op.resultSelector(a.value, b.value);
    }
  },
  testCases: [
    {
      name: 'zips two sequences together',
      source: [1, 2, 3],
      ops: [
        {
          name: 'Zip',
          args: [
            ['a', 'b'],
            (x: number, y: string) => `${x}-${y}`,
          ],
        },
      ],
      expected: ['1-a', '2-b'],
    },
  ],
};
