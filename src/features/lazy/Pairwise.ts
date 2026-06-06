import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const pairwiseFeature: FeaturePlugin = {
  name: 'Pairwise',
  kind: 'pairwise',
  category: 'lazy',
  append(pipeline) {
    return pipeline.append({ kind: 'pairwise' });
  },
  *executeSync(source) {
    const iterator = source[Symbol.iterator]();
    let previous = iterator.next();
    if (previous.done) return;
    let current = iterator.next();
    while (!current.done) {
      yield [previous.value, current.value];
      previous = current;
      current = iterator.next();
    }
  },
  testCases: [
    {
      name: 'groups adjacent elements into pairs',
      source: [1, 2, 3, 4],
      ops: [{ name: 'Pairwise', args: [] }],
      expected: [
        [1, 2],
        [2, 3],
        [3, 4],
      ],
    },
    {
      name: 'returns empty if source has less than two elements',
      source: [1],
      ops: [{ name: 'Pairwise', args: [] }],
      expected: [],
    },
    {
      name: 'returns empty if source is empty',
      source: [],
      ops: [{ name: 'Pairwise', args: [] }],
      expected: [],
    },
  ],
};
