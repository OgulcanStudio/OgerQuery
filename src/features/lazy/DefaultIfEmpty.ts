import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { Predicate, Selector, EqualityComparer, Indexed, Pair } from '../../core/types.js';
import { OpPipeline } from '../../core/OpPipeline.js';


export const defaultIfEmptyFeature: FeaturePlugin = {
  name: 'DefaultIfEmpty',
  kind: 'defaultIfEmpty',
  category: 'lazy',
  append(pipeline, defaultValue: any) {
    return pipeline.append({ kind: 'defaultIfEmpty', defaultValue });
  },
  *executeSync(source, op) {
    let hadAny = false;
    for (const item of source) {
      hadAny = true;
      yield item;
    }
    if (!hadAny) yield op.defaultValue;
  },
  testCases: [
    {
      name: 'returns default value if empty',
      source: [],
      ops: [{ name: 'DefaultIfEmpty', args: [42] }],
      expected: [42],
    },
    {
      name: 'returns original items if not empty',
      source: [1, 2],
      ops: [{ name: 'DefaultIfEmpty', args: [42] }],
      expected: [1, 2],
    },
  ],
};
