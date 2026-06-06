import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Selector, EqualityComparer } from '../../core/types.js';

export const exceptByFeature: FeaturePlugin = {
  name: 'ExceptBy',
  kind: 'exceptBy',
  category: 'materializing',
  append(pipeline, second: Iterable<any>, keySelector: Selector<any, any>, comparer?: EqualityComparer<any>) {
    return pipeline.append({
      kind: 'exceptBy',
      second,
      keySelector,
      ...(comparer !== undefined ? { comparer } : {}),
    } as any);
  },
  *executeSync(source, op) {
    if (!op.comparer) {
      const secondKeysSet = new Set(op.second);
      const yieldedKeysSet = new Set<any>();
      let index = 0;
      for (const item of source) {
        const key = op.keySelector(item, index);
        if (!secondKeysSet.has(key) && !yieldedKeysSet.has(key)) {
          yieldedKeysSet.add(key);
          yield item;
        }
        index++;
      }
      return;
    }
    const eq = op.comparer;
    const secondKeys = [...op.second];
    const yieldedKeys: any[] = [];

    let index = 0;
    for (const item of source) {
      const key = op.keySelector(item, index);
      if (!secondKeys.some((s) => eq(s, key)) && !yieldedKeys.some((y) => eq(y, key))) {
        yieldedKeys.push(key);
        yield item;
      }
      index++;
    }
  },
  testCases: [
    {
      name: 'performs set difference using key selector',
      source: [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 3, name: 'c' },
      ],
      ops: [
        {
          name: 'ExceptBy',
          args: [
            [2, 4],
            (x: any) => x.id,
          ],
        },
      ],
      expected: [
        { id: 1, name: 'a' },
        { id: 3, name: 'c' },
      ],
    },
  ],
};
