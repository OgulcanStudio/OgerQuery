import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const adjacentDistinctFeature: FeaturePlugin = {
  name: 'AdjacentDistinct',
  kind: 'adjacentDistinct',
  category: 'lazy',
  append(pipeline, comparer?: EqualityComparer<any>) {
    return pipeline.append({
      kind: 'adjacentDistinct',
      ...(comparer !== undefined ? { comparer } : {}),
    } as any);
  },
  *executeSync(source, op) {
    const eq = op.comparer ?? (Object.is as EqualityComparer<any>);
    let hasPrevious = false;
    let previous: any = undefined;
    for (const item of source) {
      if (!hasPrevious || !eq(previous, item)) {
        yield item;
        previous = item;
        hasPrevious = true;
      }
    }
  },
  testCases: [
    {
      name: 'removes consecutive duplicates',
      source: [1, 1, 2, 2, 1, 3, 3],
      ops: [{ name: 'AdjacentDistinct', args: [] }],
      expected: [1, 2, 1, 3],
    },
    {
      name: 'uses custom comparer',
      source: ['a', 'A', 'b', 'b'],
      ops: [{ name: 'AdjacentDistinct', args: [(x: string, y: string) => x.toLowerCase() === y.toLowerCase()] }],
      expected: ['a', 'b'],
    },
  ],
};
