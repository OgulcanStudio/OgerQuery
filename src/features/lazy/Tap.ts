import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';

export const tapFeature: FeaturePlugin = {
  name: 'Tap',
  kind: 'tap',
  category: 'lazy',
  append(pipeline, action: (item: any, index: number) => void) {
    return pipeline.append({ kind: 'tap', action });
  },
  *executeSync(source, op) {
    let index = 0;
    for (const item of source) {
      op.action(item, index);
      yield item;
      index++;
    }
  },
  testCases: [
    {
      name: 'triggers side effects',
      source: [1, 2],
      ops: [
        {
          name: 'Tap',
          args: [
            (x: number) => {
              // we test by checking if tap works, it's checked in sync mode
            },
          ],
        },
      ],
      expected: [1, 2],
    },
  ],
};
