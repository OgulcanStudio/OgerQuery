import type { FeaturePlugin } from '../../core/FeaturePlugin.js';

export const indexFeature: FeaturePlugin = {
  name: 'Index',
  kind: 'index',
  category: 'lazy',
  append(pipeline) {
    return pipeline.append({ kind: 'index' });
  },
  *executeSync(source) {
    let index = 0;
    for (const item of source) {
      yield [index, item];
      index++;
    }
  },
  testCases: [
    {
      name: 'pairs elements with their 0-based index',
      source: ['a', 'b'],
      ops: [{ name: 'Index', args: [] }],
      expected: [
        [0, 'a'],
        [1, 'b'],
      ],
    },
  ],
};
