import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';

const isEven = (n: number) => n % 2 === 0;

export const whereFeature: FeaturePlugin = {
  name: 'Where',
  kind: 'where',
  category: 'lazy',
  append(pipeline, predicate: Predicate<any>) {
    const last = pipeline.last;
    if (last?.kind === 'where') {
      return pipeline.replaceLast({
        kind: 'where',
        predicate: (item, index) => last.predicate(item, index) && predicate(item, index),
      });
    }
    return pipeline.append({ kind: 'where', predicate });
  },
  *executeSync(source, op) {
    let index = 0;
    for (const item of source) {
      if (op.predicate(item, index)) yield item;
      index++;
    }
  },
  testCases: [
    {
      name: 'filters even numbers',
      source: [1, 2, 3, 4, 5],
      ops: [{ name: 'Where', args: [isEven] }],
      expected: [2, 4],
    },
    {
      name: 'works with empty arrays',
      source: [],
      ops: [{ name: 'Where', args: [isEven] }],
      expected: [],
    },
    {
      name: 'fuses consecutive Where predicates',
      source: [1, 2, 3, 4, 5],
      ops: [
        { name: 'Where', args: [(n: number) => n > 2] },
        { name: 'Where', args: [(n: number) => n % 2 !== 0] },
      ],
      expected: [3, 5],
    },
  ],
};
