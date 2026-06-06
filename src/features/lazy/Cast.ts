import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const castFeature: FeaturePlugin = {
  name: 'Cast',
  kind: 'cast',
  category: 'lazy',
  append(pipeline) {
    return pipeline.append({ kind: 'cast' });
  },
  *executeSync(source) {
    yield* source;
  },
  testCases: [
    {
      name: 'casts sequence (no-op at runtime)',
      source: [1, 2, 3],
      ops: [{ name: 'Cast', args: [] }],
      expected: [1, 2, 3],
    },
  ],
};
