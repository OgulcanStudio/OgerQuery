import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const bufferFeature: FeaturePlugin = {
  name: 'Buffer',
  kind: 'buffer',
  category: 'lazy',
  append(pipeline, size: number, step = 1) {
    if (size <= 0) throw new RangeError('size must be positive');
    if (step <= 0) throw new RangeError('step must be positive');
    return pipeline.append({ kind: 'buffer', size, step });
  },
  *executeSync(source, op) {
    if (op.size <= 0) throw new RangeError('size must be positive');
    if (op.step <= 0) throw new RangeError('step must be positive');
    const window: any[] = [];
    for (const item of source) {
      window.push(item);
      while (window.length >= op.size) {
        yield window.slice(0, op.size);
        window.splice(0, Math.min(op.step, window.length));
      }
    }
  },
  testCases: [
    {
      name: 'buffers elements with sliding window',
      source: [1, 2, 3, 4],
      ops: [{ name: 'Buffer', args: [2, 1] }],
      expected: [[1, 2], [2, 3], [3, 4]],
    },
    {
      name: 'throws if size <= 0',
      source: [1, 2],
      ops: [{ name: 'Buffer', args: [0, 1] }],
      error: RangeError,
    },
    {
      name: 'throws if step <= 0',
      source: [1, 2],
      ops: [{ name: 'Buffer', args: [2, 0] }],
      error: RangeError,
    },
  ],
};
