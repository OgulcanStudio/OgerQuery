import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';

export const leftJoinFeature: FeaturePlugin = {
  name: 'LeftJoin',
  kind: 'leftJoin',
  category: 'materializing',
  append(
    pipeline,
    inner: Iterable<any>,
    outerKeySelector: Selector<any, any>,
    innerKeySelector: Selector<any, any>,
    resultSelector: (outer: any, inner: any | null) => any,
    comparer?: EqualityComparer<any>,
  ) {
    return pipeline.append({
      kind: 'leftJoin',
      inner,
      outerKeySelector,
      innerKeySelector,
      resultSelector,
      ...(comparer !== undefined ? { comparer } : {}),
    } as any);
  },
  *executeSync(source, op) {
    const { lookup, eq, isDefault } = buildJoinLookup(op.inner, op.innerKeySelector, op.comparer);
    let outerIndex = 0;
    if (isDefault) {
      for (const outerItem of source) {
        const key = op.outerKeySelector(outerItem, outerIndex);
        const matches = lookup.get(key);
        if (matches === undefined) {
          yield op.resultSelector(outerItem, null);
        } else {
          if (Array.isArray(matches)) {
            const mLen = matches.length;
            for (let i = 0; i < mLen; i++) {
              yield op.resultSelector(outerItem, matches[i]);
            }
          } else {
            yield op.resultSelector(outerItem, matches);
          }
        }
        outerIndex++;
      }
    } else {
      for (const outerItem of source) {
        const key = op.outerKeySelector(outerItem, outerIndex);
        const matches = findJoinMatches(lookup, key, eq, false);
        if (matches.length === 0) {
          yield op.resultSelector(outerItem, null);
        } else {
          for (const innerItem of matches) {
            yield op.resultSelector(outerItem, innerItem);
          }
        }
        outerIndex++;
      }
    }
  },
  testCases: [
    {
      name: 'performs left outer join',
      source: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
      ops: [
        {
          name: 'LeftJoin',
          args: [
            [{ id: 1, role: 'Admin' }],
            (o: any) => o.id,
            (i: any) => i.id,
            (o: any, i: any) => ({ name: o.name, role: i ? i.role : null }),
          ],
        },
      ],
      expected: [
        { name: 'a', role: 'Admin' },
        { name: 'b', role: null },
      ],
    },
  ],
};
