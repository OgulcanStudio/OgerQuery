import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import { orderByDescendingFeature } from './OrderByDescending.js';
import type { OrderByOptions } from './orderByHelpers.js';

export const orderDescendingFeature: FeaturePlugin = {
  name: 'OrderDescending',
  category: 'materializing',
  append(pipeline, options?: Omit<OrderByOptions, 'descending'>) {
    return orderByDescendingFeature.append!(pipeline, (x: any) => x, options);
  },
  testCases: [
    {
      name: 'sorts elements in descending order by self',
      source: [3, 1, 2],
      ops: [{ name: 'OrderDescending', args: [] }],
      expected: [3, 2, 1],
    },
  ],
};
