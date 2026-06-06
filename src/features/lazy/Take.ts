import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';

export const takeFeature: FeaturePlugin = {
  name: 'Take',
  kind: 'take',
  category: 'lazy',
  append(pipeline, count: number) {
    if (count < 0) throw new RangeError('count must be non-negative');
    const last = pipeline.last;
    if (last?.kind === 'take') {
      return pipeline.replaceLast({ kind: 'take', count: Math.min(last.count, count) });
    }
    return pipeline.append({ kind: 'take', count });
  },
  *executeSync(source, op) {
    if (op.count <= 0) return;
    let taken = 0;
    for (const item of source) {
      yield item;
      taken++;
      if (taken >= op.count) return;
    }
  },
  testCases: [
    {
      name: 'takes first N elements',
      source: [1, 2, 3, 4, 5],
      ops: [{ name: 'Take', args: [3] }],
      expected: [1, 2, 3],
    },
    {
      name: 'fuses consecutive Take counts',
      source: [1, 2, 3, 4, 5],
      ops: [
        { name: 'Take', args: [4] },
        { name: 'Take', args: [2] },
      ],
      expected: [1, 2],
    },
    {
      name: 'negative take throws RangeError',
      source: [1, 2],
      ops: [{ name: 'Take', args: [-1] }],
      error: RangeError,
    },
  ],
};
