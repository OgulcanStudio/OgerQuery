import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const selectManyFeature: FeaturePlugin = {
  name: 'SelectMany',
  kind: 'selectMany',
  category: 'lazy',
  append(pipeline, selector: Selector<any, Iterable<any>>) {
    return pipeline.append({ kind: 'selectMany', selector });
  },
  *executeSync(source, op) {
    let index = 0;
    for (const item of source) {
      yield* op.selector(item, index);
      index++;
    }
  },
  testCases: [
    {
      name: 'flattens nested iterables',
      source: [[1, 2], [3, 4]],
      ops: [{ name: 'SelectMany', args: [(x: number[]) => x] }],
      expected: [1, 2, 3, 4],
    },
  ],
};
