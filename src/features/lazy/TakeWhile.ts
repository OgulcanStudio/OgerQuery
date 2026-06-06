import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const takeWhileFeature: FeaturePlugin = {
  name: 'TakeWhile',
  kind: 'takeWhile',
  category: 'lazy',
  append(pipeline, predicate: Predicate<any>) {
    return pipeline.append({ kind: 'takeWhile', predicate });
  },
  *executeSync(source, op) {
    let index = 0;
    for (const item of source) {
      if (!op.predicate(item, index)) return;
      yield item;
      index++;
    }
  },
  testCases: [
    {
      name: 'takes elements while condition matches',
      source: [1, 2, 3, 4, 1, 2],
      ops: [{ name: 'TakeWhile', args: [(x: number) => x < 4] }],
      expected: [1, 2, 3],
    },
  ],
};
