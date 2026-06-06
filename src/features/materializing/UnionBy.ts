import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer } from '../../core/types.js';

export const unionByFeature: FeaturePlugin = {
  name: 'UnionBy',
  kind: 'unionBy',
  category: 'materializing',
  append(pipeline, second: Iterable<any>, keySelector: Selector<any, any>, comparer?: EqualityComparer<any>) {
    return pipeline.append({
      kind: 'unionBy',
      second,
      keySelector,
      ...(comparer !== undefined ? { comparer } : {}),
    } as any);
  },
  *executeSync(source, op) {
    if (!op.comparer) {
      const seenKeysSet = new Set<any>();
      let index = 0;
      for (const item of source) {
        const key = op.keySelector(item, index);
        if (!seenKeysSet.has(key)) {
          seenKeysSet.add(key);
          yield item;
        }
        index++;
      }
      let secondIndex = 0;
      for (const item of op.second) {
        const key = op.keySelector(item, secondIndex);
        if (!seenKeysSet.has(key)) {
          seenKeysSet.add(key);
          yield item;
        }
        secondIndex++;
      }
      return;
    }
    const eq = op.comparer;
    const seenKeys: any[] = [];

    let index = 0;
    for (const item of source) {
      const key = op.keySelector(item, index);
      if (!seenKeys.some((s) => eq(s, key))) {
        seenKeys.push(key);
        yield item;
      }
      index++;
    }

    let secondIndex = 0;
    for (const item of op.second) {
      const key = op.keySelector(item, secondIndex);
      if (!seenKeys.some((s) => eq(s, key))) {
        seenKeys.push(key);
        yield item;
      }
      secondIndex++;
    }
  },
  testCases: [
    {
      name: 'performs set union using key selector',
      source: [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
      ],
      ops: [
        {
          name: 'UnionBy',
          args: [
            [
              { id: 2, name: 'c' },
              { id: 3, name: 'd' },
            ],
            (x: any) => x.id,
          ],
        },
      ],
      expected: [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 3, name: 'd' },
      ],
    },
  ],
};
