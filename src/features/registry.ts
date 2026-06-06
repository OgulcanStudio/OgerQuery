import { registerFeature, type FeaturePlugin } from '../core/FeaturePlugin.js';

import { whereFeature } from './lazy/Where.js';
import { selectFeature } from './lazy/Select.js';
import { selectManyFeature } from './lazy/SelectMany.js';
import { ofTypeFeature } from './lazy/OfType.js';
import { castFeature } from './lazy/Cast.js';
import { takeFeature } from './lazy/Take.js';
import { skipFeature } from './lazy/Skip.js';
import { takeWhileFeature } from './lazy/TakeWhile.js';
import { skipWhileFeature } from './lazy/SkipWhile.js';
import { defaultIfEmptyFeature } from './lazy/DefaultIfEmpty.js';
import { chunkFeature } from './lazy/Chunk.js';
import { scanFeature } from './lazy/Scan.js';
import { withIndexFeature } from './lazy/WithIndex.js';
import { bufferFeature } from './lazy/Buffer.js';
import { tryWhereFeature } from './lazy/TryWhere.js';
import { pairwiseFeature } from './lazy/Pairwise.js';
import { tapFeature } from './lazy/Tap.js';
import { flattenFeature } from './lazy/Flatten.js';
import { adjacentDistinctFeature } from './lazy/AdjacentDistinct.js';
import { prependFeature } from './lazy/Prepend.js';
import { appendFeature } from './lazy/Append.js';
import { indexFeature } from './lazy/Index.js';
import { takeLastFeature } from './lazy/TakeLast.js';
import { skipLastFeature } from './lazy/SkipLast.js';

import { orderByFeature } from './materializing/OrderBy.js';
import { orderByDescendingFeature } from './materializing/OrderByDescending.js';
import { thenByFeature } from './materializing/ThenBy.js';
import { thenByDescendingFeature } from './materializing/ThenByDescending.js';
import { reverseFeature } from './materializing/Reverse.js';
import { distinctFeature } from './materializing/Distinct.js';
import { distinctByFeature } from './materializing/DistinctBy.js';
import { groupByFeature } from './materializing/GroupBy.js';
import { joinFeature } from './materializing/Join.js';
import { groupJoinFeature } from './materializing/GroupJoin.js';
import { leftJoinFeature } from './materializing/LeftJoin.js';
import { rightJoinFeature } from './materializing/RightJoin.js';
import { fullJoinFeature } from './materializing/FullJoin.js';
import { zipFeature } from './materializing/Zip.js';
import { concatFeature } from './materializing/Concat.js';
import { unionFeature } from './materializing/Union.js';
import { intersectFeature } from './materializing/Intersect.js';
import { exceptFeature } from './materializing/Except.js';
import { orderFeature } from './materializing/Order.js';
import { orderDescendingFeature } from './materializing/OrderDescending.js';
import { aggregateByFeature } from './materializing/AggregateBy.js';
import { unionByFeature } from './materializing/UnionBy.js';
import { intersectByFeature } from './materializing/IntersectBy.js';
import { exceptByFeature } from './materializing/ExceptBy.js';

import { toArrayFeature } from './terminal/ToArray.js';
import { toListFeature } from './terminal/ToList.js';
import { forEachFeature } from './terminal/ForEach.js';
import { firstFeature } from './terminal/First.js';
import { firstOrDefaultFeature } from './terminal/FirstOrDefault.js';
import { lastFeature } from './terminal/Last.js';
import { lastOrDefaultFeature } from './terminal/LastOrDefault.js';
import { singleFeature } from './terminal/Single.js';
import { singleOrDefaultFeature } from './terminal/SingleOrDefault.js';
import { elementAtFeature } from './terminal/ElementAt.js';
import { elementAtOrDefaultFeature } from './terminal/ElementAtOrDefault.js';
import { anyFeature } from './terminal/Any.js';
import { allFeature } from './terminal/All.js';
import { containsFeature } from './terminal/Contains.js';
import { sequenceEqualFeature } from './terminal/SequenceEqual.js';
import { countFeature } from './terminal/Count.js';
import { longCountFeature } from './terminal/LongCount.js';
import { sumFeature } from './terminal/Sum.js';
import { minFeature } from './terminal/Min.js';
import { maxFeature } from './terminal/Max.js';
import { averageFeature } from './terminal/Average.js';
import { aggregateFeature } from './terminal/Aggregate.js';
import { minByFeature } from './terminal/MinBy.js';
import { maxByFeature } from './terminal/MaxBy.js';
import { toDictionaryFeature } from './terminal/ToDictionary.js';
import { toLookupFeature } from './terminal/ToLookup.js';
import { partitionFeature } from './terminal/Partition.js';
import { splitAtFeature } from './terminal/SplitAt.js';
import { toSetFeature } from './terminal/ToSet.js';
import { toMapFeature } from './terminal/ToMap.js';
import { toObjectFeature } from './terminal/ToObject.js';
import { reduceFeature } from './terminal/Reduce.js';
import { firstOrThrowFeature } from './terminal/FirstOrThrow.js';
import { lastOrThrowFeature } from './terminal/LastOrThrow.js';
import { singleOrThrowFeature } from './terminal/SingleOrThrow.js';
import { medianFeature } from './terminal/Median.js';
import { modeFeature } from './terminal/Mode.js';
import { percentileFeature } from './terminal/Percentile.js';
import { countByFeature } from './terminal/CountBy.js';
import { paginateFeature } from './terminal/Paginate.js';
import { cursorPageFeature } from './terminal/CursorPage.js';

export const allFeatures: FeaturePlugin[] = [
  // Lazy
  whereFeature,
  selectFeature,
  selectManyFeature,
  ofTypeFeature,
  castFeature,
  takeFeature,
  skipFeature,
  takeWhileFeature,
  skipWhileFeature,
  defaultIfEmptyFeature,
  chunkFeature,
  scanFeature,
  withIndexFeature,
  bufferFeature,
  tryWhereFeature,
  pairwiseFeature,
  tapFeature,
  flattenFeature,
  adjacentDistinctFeature,
  prependFeature,
  appendFeature,
  indexFeature,
  takeLastFeature,
  skipLastFeature,

  // Materializing
  orderByFeature,
  orderByDescendingFeature,
  thenByFeature,
  thenByDescendingFeature,
  reverseFeature,
  distinctFeature,
  distinctByFeature,
  groupByFeature,
  joinFeature,
  groupJoinFeature,
  leftJoinFeature,
  rightJoinFeature,
  fullJoinFeature,
  zipFeature,
  concatFeature,
  unionFeature,
  intersectFeature,
  exceptFeature,
  orderFeature,
  orderDescendingFeature,
  aggregateByFeature,
  unionByFeature,
  intersectByFeature,
  exceptByFeature,

  // Terminal
  toArrayFeature,
  toListFeature,
  forEachFeature,
  firstFeature,
  firstOrDefaultFeature,
  lastFeature,
  lastOrDefaultFeature,
  singleFeature,
  singleOrDefaultFeature,
  elementAtFeature,
  elementAtOrDefaultFeature,
  anyFeature,
  allFeature,
  containsFeature,
  sequenceEqualFeature,
  countFeature,
  longCountFeature,
  sumFeature,
  minFeature,
  maxFeature,
  averageFeature,
  aggregateFeature,
  minByFeature,
  maxByFeature,
  toDictionaryFeature,
  toLookupFeature,
  partitionFeature,
  splitAtFeature,
  toSetFeature,
  toMapFeature,
  toObjectFeature,
  reduceFeature,
  firstOrThrowFeature,
  lastOrThrowFeature,
  singleOrThrowFeature,
  medianFeature,
  modeFeature,
  percentileFeature,
  countByFeature,
  paginateFeature,
  cursorPageFeature,
];

// Initialize registration
for (const feature of allFeatures) {
  registerFeature(feature);
}
