import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';

export const groupJoinFeature: FeaturePlugin = {
  name: 'GroupJoin',
  kind: 'groupJoin',
  category: 'materializing',
  append(
    pipeline,
    inner: Iterable<any>,
    outerKeySelector: Selector<any, any>,
    innerKeySelector: Selector<any, any>,
    resultSelector: (outer: any, inner: Iterable<any>) => any,
    comparer?: EqualityComparer<any>,
  ) {
    return pipeline.append({
      kind: 'groupJoin',
      inner,
      outerKeySelector,
      innerKeySelector,
      resultSelector,
      ...(comparer !== undefined ? { comparer } : {}),
    } as any);
  },
  *executeSync(source, op) {
    const isDefault = op.comparer === undefined;
    const eq = op.comparer ?? (Object.is as EqualityComparer<any>);
    const innerLookup = new Map<unknown, any[]>();
    let innerIndex = 0;
    for (const item of op.inner) {
      const key = op.innerKeySelector(item, innerIndex);
      const list = innerLookup.get(key);
      if (list) list.push(item);
      else innerLookup.set(key, [item]);
      innerIndex++;
    }
    let outerIndex = 0;
    for (const outerItem of source) {
      const key = op.outerKeySelector(outerItem, outerIndex);
      let matches: any[];
      if (isDefault) {
        matches = innerLookup.get(key) ?? [];
      } else {
        matches = [];
        for (const [storedKey, inners] of innerLookup) {
          if (eq(storedKey, key)) matches.push(...inners);
        }
      }
      yield op.resultSelector(outerItem, matches);
      outerIndex++;
    }
  },
  testCases: [
    {
      name: 'performs group join',
      source: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
      ops: [
        {
          name: 'GroupJoin',
          args: [
            [{ id: 1, role: 'Admin' }, { id: 1, role: 'User' }],
            (o: any) => o.id,
            (i: any) => i.id,
            (o: any, i: any[]) => ({ name: o.name, roles: i.map(r => r.role) }),
          ],
        },
      ],
      expected: [
        { name: 'a', roles: ['Admin', 'User'] },
        { name: 'b', roles: [] },
      ],
    },
    {
      name: 'groupJoin with custom comparer',
      source: [{ id: 1 }, { id: 2 }],
      ops: [
        {
          name: 'GroupJoin',
          args: [
            [{ id: 1 }, { id: 1 }],
            (o: any) => o.id,
            (i: any) => i.id,
            (o: any, g: any[]) => g.length,
            (a: any, b: any) => a === b
          ]
        }
      ],
      expected: [2, 0]
    }
  ],
};
