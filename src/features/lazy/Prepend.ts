import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const prependFeature: FeaturePlugin = {
  name: 'Prepend',
  kind: 'prepend',
  category: 'lazy',
  append(pipeline, items: Iterable<any>) {
    return pipeline.append({ kind: 'prepend', items });
  },
  *executeSync(source, op) {
    yield* op.items;
    yield* source;
  },
  testCases: [
    {
      name: 'prepends elements lazy',
      source: [3, 4],
      ops: [{ name: 'Prepend', args: [[1, 2]] }],
      expected: [1, 2, 3, 4],
    },
  ],
};
