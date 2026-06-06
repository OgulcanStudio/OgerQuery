import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';

export const tryWhereFeature: FeaturePlugin = {
  name: 'TryWhere',
  kind: 'tryWhere',
  category: 'lazy',
  append(pipeline, predicate: Predicate<any>) {
    return pipeline.append({ kind: 'tryWhere', predicate });
  },
  *executeSync(source, op) {
    let index = 0;
    for (const item of source) {
      try {
        if (op.predicate(item, index)) yield item;
      } catch {
        // ignore predicate throws
      }
      index++;
    }
  },
  testCases: [
    {
      name: 'ignores elements where predicate throws',
      source: [1, 2, 3, 4],
      ops: [
        {
          name: 'TryWhere',
          args: [
            (x: number) => {
              if (x === 2) throw new Error('boom');
              return x % 2 === 0;
            },
          ],
        },
      ],
      expected: [4],
    },
  ],
};
