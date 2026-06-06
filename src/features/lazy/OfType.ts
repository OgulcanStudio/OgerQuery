import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


const defaultObjectGuard = (item: unknown): boolean =>
  item !== null && item !== undefined && typeof item === 'object';

export const ofTypeFeature: FeaturePlugin = {
  name: 'OfType',
  kind: 'ofType',
  category: 'lazy',
  append(pipeline, guard?: (item: unknown) => boolean) {
    return pipeline.append({ kind: 'ofType', ...(guard ? { guard } : {}) });
  },
  *executeSync(source, op) {
    const guard = op.guard ?? defaultObjectGuard;
    for (const item of source) {
      if (guard(item)) yield item;
    }
  },
  testCases: [
    {
      name: 'filters object types',
      source: [1, null, { a: 1 }, 'test', undefined, [2]],
      ops: [{ name: 'OfType', args: [] }],
      expected: [{ a: 1 }, [2]],
    },
  ],
};
