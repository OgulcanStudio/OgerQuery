import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const appendFeature: FeaturePlugin = {
  name: 'Append',
  kind: 'append',
  category: 'lazy',
  append(pipeline, items: Iterable<any>) {
    return pipeline.append({ kind: 'append', items });
  },
  *executeSync(source, op) {
    yield* source;
    yield* op.items;
  },
  testCases: [
    {
      name: 'appends elements lazy',
      source: [1, 2],
      ops: [{ name: 'Append', args: [[3, 4]] }],
      expected: [1, 2, 3, 4],
    },
  ],
};
