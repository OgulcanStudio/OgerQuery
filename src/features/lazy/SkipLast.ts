import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import { SkipLastBuffer } from '../../utils/slidingWindow.js';

export const skipLastFeature: FeaturePlugin = {
  name: 'SkipLast',
  kind: 'skipLast',
  category: 'lazy',
  append(pipeline, count: number) {
    return pipeline.append({ kind: 'skipLast', count });
  },
  *executeSync(source, op) {
    const count = op.count;
    if (count <= 0) {
      yield* source;
      return;
    }

    const buffer = new SkipLastBuffer(op.count);
    for (const item of source) {
      const out = buffer.push(item);
      if (out !== undefined) yield out;
    }
  },
  testCases: [
    {
      name: 'skips the last N elements',
      source: [1, 2, 3, 4, 5],
      ops: [{ name: 'SkipLast', args: [2] }],
      expected: [1, 2, 3],
    },
    {
      name: 'skips nothing when count <= 0',
      source: [1, 2, 3],
      ops: [{ name: 'SkipLast', args: [0] }],
      expected: [1, 2, 3],
    },
    {
      name: 'skips all elements if count exceeds source size',
      source: [1, 2, 3],
      ops: [{ name: 'SkipLast', args: [5] }],
      expected: [],
    },
  ],
};
