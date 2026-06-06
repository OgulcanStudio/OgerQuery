import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const selectFeature: FeaturePlugin = {
  name: 'Select',
  kind: 'select',
  category: 'lazy',
  append(pipeline, selector: Selector<any, any>) {
    const last = pipeline.last;
    if (last?.kind === 'select') {
      return pipeline.replaceLast({
        kind: 'select',
        selector: (item, index) => selector(last.selector(item, index), index),
      });
    }
    return pipeline.append({ kind: 'select', selector });
  },
  *executeSync(source, op) {
    let index = 0;
    for (const item of source) {
      yield op.selector(item, index);
      index++;
    }
  },
  testCases: [
    {
      name: 'transforms values',
      source: [1, 2, 3],
      ops: [{ name: 'Select', args: [(x: number) => x * 2] }],
      expected: [2, 4, 6],
    },
    {
      name: 'fuses consecutive Select selectors',
      source: [1, 2, 3],
      ops: [
        { name: 'Select', args: [(x: number) => x + 1] },
        { name: 'Select', args: [(x: number) => String(x)] },
      ],
      expected: ['2', '3', '4'],
    },
  ],
};
