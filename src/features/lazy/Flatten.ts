import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const flattenFeature: FeaturePlugin = {
  name: 'Flatten',
  kind: 'flatten',
  category: 'lazy',
  append(pipeline) {
    return pipeline.append({ kind: 'flatten' });
  },
  *executeSync(source) {
    for (const inner of source) {
      yield* inner;
    }
  },
  testCases: [
    {
      name: 'flattens one level',
      source: [[1, 2], [3]],
      ops: [{ name: 'Flatten', args: [] }],
      expected: [1, 2, 3],
    },
  ],
};
