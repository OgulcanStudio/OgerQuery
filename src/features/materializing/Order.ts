import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import { orderByFeature } from './OrderBy.js';
import type { OrderByOptions } from './orderByHelpers.js';

export const orderFeature: FeaturePlugin = {
  name: 'Order',
  category: 'materializing',
  append(pipeline, options?: OrderByOptions) {
    return orderByFeature.append!(pipeline, (x: any) => x, options ?? false);
  },
  testCases: [
    {
      name: 'sorts elements in ascending order by self',
      source: [3, 1, 2],
      ops: [{ name: 'Order', args: [] }],
      expected: [1, 2, 3],
    },
  ],
};
