import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import { TakeLastBuffer } from '../../utils/slidingWindow.js';

export const takeLastFeature: FeaturePlugin = {
  name: 'TakeLast',
  kind: 'takeLast',
  category: 'lazy',
  append(pipeline, count: number) {
    return pipeline.append({ kind: 'takeLast', count });
  },
  *executeSync(source, op) {
    const count = op.count;
    if (count <= 0) return;

    const buffer = new TakeLastBuffer(op.count);
    for (const item of source) {
      buffer.push(item);
    }
    yield* buffer;
  },
  testCases: [
    {
      name: 'takes the last N elements',
      source: [1, 2, 3, 4, 5],
      ops: [{ name: 'TakeLast', args: [2] }],
      expected: [4, 5],
    },
    {
      name: 'returns empty when count <= 0',
      source: [1, 2, 3],
      ops: [{ name: 'TakeLast', args: [0] }],
      expected: [],
    },
    {
      name: 'returns all elements if count exceeds source size',
      source: [1, 2, 3],
      ops: [{ name: 'TakeLast', args: [5] }],
      expected: [1, 2, 3],
    },
  ],
};
