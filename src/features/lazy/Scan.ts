import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const scanFeature: FeaturePlugin = {
  name: 'Scan',
  kind: 'scan',
  category: 'lazy',
  append(pipeline, seed: any, func: (acc: any, item: any, index: number) => any) {
    return pipeline.append({ kind: 'scan', seed, func });
  },
  *executeSync(source, op) {
    let acc = op.seed;
    yield acc;
    let index = 0;
    for (const item of source) {
      acc = op.func(acc, item, index);
      yield acc;
      index++;
    }
  },
  testCases: [
    {
      name: 'scans accumulator over elements',
      source: [1, 2, 3],
      ops: [{ name: 'Scan', args: [0, (acc: number, x: number) => acc + x] }],
      expected: [0, 1, 3, 6],
    },
  ],
};
