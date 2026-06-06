import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';
import { leftJoinFeature } from './LeftJoin.js';

export const rightJoinFeature: FeaturePlugin = {
  name: 'RightJoin',
  kind: 'rightJoin',
  category: 'materializing',
  append(
    pipeline,
    inner: Iterable<any>,
    outerKeySelector: Selector<any, any>,
    innerKeySelector: Selector<any, any>,
    resultSelector: (outer: any | null, inner: any) => any,
    comparer?: EqualityComparer<any>,
  ) {
    return pipeline.append({
      kind: 'rightJoin',
      inner,
      outerKeySelector,
      innerKeySelector,
      resultSelector,
      ...(comparer !== undefined ? { comparer } : {}),
    } as any);
  },
  executeSync(source, op) {
    return leftJoinFeature.executeSync!(
      op.inner,
      {
        ...op,
        inner: source,
        outerKeySelector: op.innerKeySelector,
        innerKeySelector: op.outerKeySelector,
        resultSelector: (innerItem: any, outerItem: any) => op.resultSelector(outerItem, innerItem),
      }
    );
  },
  testCases: [
    {
      name: 'performs right outer join',
      source: [{ id: 1, name: 'a' }],
      ops: [
        {
          name: 'RightJoin',
          args: [
            [{ id: 1, role: 'Admin' }, { id: 2, role: 'User' }],
            (o: any) => o.id,
            (i: any) => i.id,
            (o: any, i: any) => ({ name: o ? o.name : null, role: i.role }),
          ],
        },
      ],
      expected: [
        { name: 'a', role: 'Admin' },
        { name: null, role: 'User' },
      ],
    },
  ],
};
