import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer } from '../../core/types.js';

export const aggregateByFeature: FeaturePlugin = {
  name: 'AggregateBy',
  kind: 'aggregateBy',
  category: 'materializing',
  append(pipeline, keySelector: Selector<any, any>, seed: any, func: (acc: any, item: any) => any, comparer?: EqualityComparer<any>) {
    return pipeline.append({
      kind: 'aggregateBy',
      keySelector,
      seed,
      func,
      ...(comparer !== undefined ? { comparer } : {}),
    } as any);
  },
  *executeSync(source, op) {
    const eq = op.comparer ?? (Object.is as EqualityComparer<any>);
    const groups: { key: any; acc: any }[] = [];
    const useMap = !op.comparer;
    const map = new Map<any, any>();

    let index = 0;
    for (const item of source) {
      const key = op.keySelector(item, index);
      if (useMap) {
        if (!map.has(key)) {
          const seed = typeof op.seed === 'function' ? op.seed(item) : op.seed;
          map.set(key, seed);
        }
        const currentAcc = map.get(key);
        map.set(key, op.func(currentAcc, item));
      } else {
        let entry = groups.find((g) => eq(g.key, key));
        if (!entry) {
          const seed = typeof op.seed === 'function' ? op.seed(item) : op.seed;
          entry = { key, acc: seed };
          groups.push(entry);
        }
        entry.acc = op.func(entry.acc, item);
      }
      index++;
    }

    if (useMap) {
      for (const [key, acc] of map.entries()) {
        yield [key, acc];
      }
    } else {
      for (const g of groups) {
        yield [g.key, g.acc];
      }
    }
  },
  testCases: [
    {
      name: 'aggregates values by key with static seed',
      source: [
        { category: 'A', value: 10 },
        { category: 'B', value: 20 },
        { category: 'A', value: 30 },
      ],
      ops: [
        {
          name: 'AggregateBy',
          args: [
            (x: any) => x.category,
            0,
            (acc: number, item: any) => acc + item.value,
          ],
        },
      ],
      expected: [
        ['A', 40],
        ['B', 20],
      ],
    },
    {
      name: 'aggregates values by key with seed selector function',
      source: [
        { category: 'A', value: 10 },
        { category: 'B', value: 20 },
        { category: 'A', value: 30 },
      ],
      ops: [
        {
          name: 'AggregateBy',
          args: [
            (x: any) => x.category,
            (item: any) => item.value * 2,
            (acc: number, item: any) => acc + item.value,
          ],
        },
      ],
      expected: [
        ['A', 60], // seed = 10 * 2 = 20. item1: 20 + 10 = 30. item2: 30 + 30 = 60.
        ['B', 60], // seed = 20 * 2 = 40. item1: 40 + 20 = 60.
      ],
    },
    {
      name: 'aggregates with custom comparer and seed selector function',
      source: [
        { category: 'a', value: 10 },
        { category: 'B', value: 20 },
        { category: 'A', value: 30 },
      ],
      ops: [
        {
          name: 'AggregateBy',
          args: [
            (x: any) => x.category,
            (item: any) => item.value * 2,
            (acc: number, item: any) => acc + item.value,
            (k1: string, k2: string) => k1.toLowerCase() === k2.toLowerCase(),
          ],
        },
      ],
      expected: [
        ['a', 60],
        ['B', 60],
      ],
    },
  ],
};
