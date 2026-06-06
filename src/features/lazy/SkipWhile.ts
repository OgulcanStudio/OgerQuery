import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const skipWhileFeature: FeaturePlugin = {
  name: 'SkipWhile',
  kind: 'skipWhile',
  category: 'lazy',
  append(pipeline, predicate: Predicate<any>) {
    return pipeline.append({ kind: 'skipWhile', predicate });
  },
  *executeSync(source, op) {
    let index = 0;
    let skipping = true;
    for (const item of source) {
      if (skipping) {
        if (op.predicate(item, index)) {
          index++;
          continue;
        }
        skipping = false;
      }
      yield item;
      index++;
    }
  },
  testCases: [
    {
      name: 'skips elements while condition matches',
      source: [1, 2, 3, 4, 1, 2],
      ops: [{ name: 'SkipWhile', args: [(x: number) => x < 3] }],
      expected: [3, 4, 1, 2],
    },
  ],
};
