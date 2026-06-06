import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const withIndexFeature: FeaturePlugin = {
  name: 'WithIndex',
  kind: 'withIndex',
  category: 'lazy',
  append(pipeline) {
    return pipeline.append({ kind: 'withIndex' });
  },
  *executeSync(source) {
    let index = 0;
    for (const item of source) {
      yield { value: item, index };
      index++;
    }
  },
  testCases: [
    {
      name: 'pairs elements with index',
      source: ['a', 'b'],
      ops: [{ name: 'WithIndex', args: [] }],
      expected: [
        { value: 'a', index: 0 },
        { value: 'b', index: 1 },
      ],
    },
  ],
};
