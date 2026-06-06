import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const chunkFeature: FeaturePlugin = {
  name: 'Chunk',
  kind: 'chunk',
  category: 'lazy',
  append(pipeline, size: number) {
    if (size <= 0) throw new RangeError('size must be positive');
    return pipeline.append({ kind: 'chunk', size });
  },
  *executeSync(source, op) {
    if (op.size <= 0) throw new RangeError('size must be positive');
    let bucket: any[] = [];
    for (const item of source) {
      bucket.push(item);
      if (bucket.length >= op.size) {
        yield bucket;
        bucket = [];
      }
    }
    if (bucket.length > 0) yield bucket;
  },
  testCases: [
    {
      name: 'chunks array into groups of size N',
      source: [1, 2, 3, 4, 5],
      ops: [{ name: 'Chunk', args: [2] }],
      expected: [[1, 2], [3, 4], [5]],
    },
    {
      name: 'zero chunk size throws RangeError',
      source: [1, 2],
      ops: [{ name: 'Chunk', args: [0] }],
      error: RangeError,
    },
  ],
};
