import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const skipFeature: FeaturePlugin = {
  name: 'Skip',
  kind: 'skip',
  category: 'lazy',
  append(pipeline, count: number) {
    if (count < 0) throw new RangeError('count must be non-negative');
    const last = pipeline.last;
    if (last?.kind === 'skip') {
      return pipeline.replaceLast({ kind: 'skip', count: last.count + count });
    }
    return pipeline.append({ kind: 'skip', count });
  },
  *executeSync(source, op) {
    if (op.count <= 0) {
      yield* source;
      return;
    }
    let skipped = 0;
    for (const item of source) {
      if (skipped >= op.count) yield item;
      else skipped++;
    }
  },
  testCases: [
    {
      name: 'skips first N elements',
      source: [1, 2, 3, 4, 5],
      ops: [{ name: 'Skip', args: [2] }],
      expected: [3, 4, 5],
    },
    {
      name: 'fuses consecutive Skip counts',
      source: [1, 2, 3, 4, 5],
      ops: [
        { name: 'Skip', args: [1] },
        { name: 'Skip', args: [2] },
      ],
      expected: [4, 5],
    },
    {
      name: 'negative skip throws RangeError',
      source: [1, 2],
      ops: [{ name: 'Skip', args: [-1] }],
      error: RangeError,
    },
  ],
};
