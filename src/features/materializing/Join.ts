import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer, Comparer, IGrouping } from '../../core/types.js';
import { Grouping } from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { buildJoinLookup, findJoinMatches } from '../../utils/joinLookup.js';
import { compareNullSortKeys } from '../../utils/path.js';
import type { NullSortStrategy, OrderKeyEntry } from '../../core/pipelineOps.js';
import { toEntry, compareOrderKeys, stableSortInPlace, type OrderByOptions } from './orderByHelpers.js';

export const joinFeature: FeaturePlugin = {
  name: 'Join',
  kind: 'join',
  category: 'materializing',
  append(
    pipeline,
    inner: Iterable<any>,
    outerKeySelector: Selector<any, any>,
    innerKeySelector: Selector<any, any>,
    resultSelector: (outer: any, inner: any) => any,
    comparer?: EqualityComparer<any>,
  ) {
    return pipeline.append({
      kind: 'join',
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
        if (matches !== undefined) {
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
        for (const innerItem of matches) {
          yield op.resultSelector(outerItem, innerItem);
        }
        outerIndex++;
      }
    }
  },
  testCases: [
    {
      name: 'performs inner join',
      source: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
      ops: [
        {
          name: 'Join',
          args: [
            [{ id: 1, role: 'Admin' }, { id: 3, role: 'User' }],
            (o: any) => o.id,
            (i: any) => i.id,
            (o: any, i: any) => ({ name: o.name, role: i.role }),
          ],
        },
      ],
      expected: [{ name: 'a', role: 'Admin' }],
    },
    {
      name: 'join with custom comparer',
      source: [{ k: 'a' }],
      ops: [
        {
          name: 'Join',
          args: [
            [{ k: 'A' }],
            (o: any) => o.k,
            (i: any) => i.k,
            (o: any, i: any) => o.k + i.k,
            (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
          ]
        }
      ],
      expected: ['aA']
    },
    {
      name: 'join handles multiple duplicate keys',
      source: [{ k: 1 }, { k: 1 }],
      ops: [
        {
          name: 'Join',
          args: [
            [{ k: 1 }, { k: 1 }],
            (o: any) => o.k,
            (i: any) => i.k,
            (o: any, i: any) => o.k + i.k
          ]
        }
      ],
      expected: [2, 2, 2, 2]
    }
  ],
};
