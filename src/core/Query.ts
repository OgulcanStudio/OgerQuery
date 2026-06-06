import type { PageResult, CursorPageResult } from '../pagination/types.js';
import * as objectPredicates from '../helpers/predicates.js';
import { explainPipeline, explainPipelineText } from '../debug/explain.js';
import { executePipeline } from './executor.js';
import { OpPipeline } from './OpPipeline.js';
import type {
  EqualityComparer,
  IGrouping,
  Lookup,
  OrderKey,
  Predicate,
  Selector,
  Indexed,
  Pair,
} from './types.js';

// Modular Feature Imports
import { whereFeature } from '../features/lazy/Where.js';
import { selectFeature } from '../features/lazy/Select.js';
import { selectManyFeature } from '../features/lazy/SelectMany.js';
import { ofTypeFeature } from '../features/lazy/OfType.js';
import { castFeature } from '../features/lazy/Cast.js';
import { takeFeature } from '../features/lazy/Take.js';
import { skipFeature } from '../features/lazy/Skip.js';
import { takeWhileFeature } from '../features/lazy/TakeWhile.js';
import { skipWhileFeature } from '../features/lazy/SkipWhile.js';
import { defaultIfEmptyFeature } from '../features/lazy/DefaultIfEmpty.js';
import { chunkFeature } from '../features/lazy/Chunk.js';
import { scanFeature } from '../features/lazy/Scan.js';
import { withIndexFeature } from '../features/lazy/WithIndex.js';
import { bufferFeature } from '../features/lazy/Buffer.js';
import { tryWhereFeature } from '../features/lazy/TryWhere.js';
import { pairwiseFeature } from '../features/lazy/Pairwise.js';
import { tapFeature } from '../features/lazy/Tap.js';
import { flattenFeature } from '../features/lazy/Flatten.js';
import { adjacentDistinctFeature } from '../features/lazy/AdjacentDistinct.js';
import { prependFeature } from '../features/lazy/Prepend.js';
import { appendFeature } from '../features/lazy/Append.js';
import { orderByFeature } from '../features/materializing/OrderBy.js';
import { orderByDescendingFeature } from '../features/materializing/OrderByDescending.js';
import { thenByFeature } from '../features/materializing/ThenBy.js';
import { thenByDescendingFeature } from '../features/materializing/ThenByDescending.js';
import { reverseFeature } from '../features/materializing/Reverse.js';
import { distinctFeature } from '../features/materializing/Distinct.js';
import { distinctByFeature } from '../features/materializing/DistinctBy.js';
import { groupByFeature } from '../features/materializing/GroupBy.js';
import { joinFeature } from '../features/materializing/Join.js';
import { groupJoinFeature } from '../features/materializing/GroupJoin.js';
import { leftJoinFeature } from '../features/materializing/LeftJoin.js';
import { rightJoinFeature } from '../features/materializing/RightJoin.js';
import { fullJoinFeature } from '../features/materializing/FullJoin.js';
import { zipFeature } from '../features/materializing/Zip.js';
import { concatFeature } from '../features/materializing/Concat.js';
import { unionFeature } from '../features/materializing/Union.js';
import { intersectFeature } from '../features/materializing/Intersect.js';
import { exceptFeature } from '../features/materializing/Except.js';
import { toArrayFeature } from '../features/terminal/ToArray.js';
import { toListFeature } from '../features/terminal/ToList.js';
import { forEachFeature } from '../features/terminal/ForEach.js';
import { firstFeature } from '../features/terminal/First.js';
import { firstOrDefaultFeature } from '../features/terminal/FirstOrDefault.js';
import { lastFeature } from '../features/terminal/Last.js';
import { lastOrDefaultFeature } from '../features/terminal/LastOrDefault.js';
import { singleFeature } from '../features/terminal/Single.js';
import { singleOrDefaultFeature } from '../features/terminal/SingleOrDefault.js';
import { elementAtFeature } from '../features/terminal/ElementAt.js';
import { elementAtOrDefaultFeature } from '../features/terminal/ElementAtOrDefault.js';
import { anyFeature } from '../features/terminal/Any.js';
import { allFeature } from '../features/terminal/All.js';
import { containsFeature } from '../features/terminal/Contains.js';
import { sequenceEqualFeature } from '../features/terminal/SequenceEqual.js';
import { countFeature } from '../features/terminal/Count.js';
import { longCountFeature } from '../features/terminal/LongCount.js';
import { sumFeature } from '../features/terminal/Sum.js';
import { minFeature } from '../features/terminal/Min.js';
import { maxFeature } from '../features/terminal/Max.js';
import { averageFeature } from '../features/terminal/Average.js';
import { aggregateFeature } from '../features/terminal/Aggregate.js';
import { minByFeature } from '../features/terminal/MinBy.js';
import { maxByFeature } from '../features/terminal/MaxBy.js';
import { toDictionaryFeature } from '../features/terminal/ToDictionary.js';
import { toLookupFeature } from '../features/terminal/ToLookup.js';
import { partitionFeature } from '../features/terminal/Partition.js';
import { splitAtFeature } from '../features/terminal/SplitAt.js';
import { toSetFeature } from '../features/terminal/ToSet.js';
import { toMapFeature } from '../features/terminal/ToMap.js';
import { toObjectFeature } from '../features/terminal/ToObject.js';
import { reduceFeature } from '../features/terminal/Reduce.js';
import { firstOrThrowFeature } from '../features/terminal/FirstOrThrow.js';
import { lastOrThrowFeature } from '../features/terminal/LastOrThrow.js';
import { singleOrThrowFeature } from '../features/terminal/SingleOrThrow.js';
import { medianFeature } from '../features/terminal/Median.js';
import { modeFeature } from '../features/terminal/Mode.js';
import { percentileFeature } from '../features/terminal/Percentile.js';
import { countByFeature } from '../features/terminal/CountBy.js';
import { paginateFeature } from '../features/terminal/Paginate.js';
import { cursorPageFeature } from '../features/terminal/CursorPage.js';
import { indexFeature } from '../features/lazy/Index.js';
import { takeLastFeature } from '../features/lazy/TakeLast.js';
import { skipLastFeature } from '../features/lazy/SkipLast.js';
import { orderFeature } from '../features/materializing/Order.js';
import { orderDescendingFeature } from '../features/materializing/OrderDescending.js';
import { aggregateByFeature } from '../features/materializing/AggregateBy.js';
import { unionByFeature } from '../features/materializing/UnionBy.js';
import { intersectByFeature } from '../features/materializing/IntersectBy.js';
import { exceptByFeature } from '../features/materializing/ExceptBy.js';
import type { OrderByOptions } from '../features/materializing/orderByHelpers.js';

export class Query<T> implements Iterable<T> {
  constructor(
    private readonly source: Iterable<T>,
    readonly pipeline: OpPipeline<T> = new OpPipeline(),
  ) {}

  private chain<R>(pipeline: OpPipeline<R>): Query<R> {
    return new Query(this.source as unknown as Iterable<R>, pipeline);
  }

  [Symbol.iterator](): Iterator<T> {
    return executePipeline(this.source, this.pipeline);
  }

  Where(predicate: Predicate<T>): Query<T> {
    return this.chain(whereFeature.append!(this.pipeline, predicate));
  }

  Select<R>(selector: Selector<T, R>): Query<R> {
    return this.chain(selectFeature.append!(this.pipeline, selector)) as Query<R>;
  }

  SelectMany<R>(selector: Selector<T, Iterable<R>>): Query<R> {
    return this.chain(selectManyFeature.append!(this.pipeline, selector));
  }

  OfType<R extends T>(guard?: (item: T) => item is R): Query<R> {
    return this.chain(ofTypeFeature.append!(this.pipeline, guard as (item: unknown) => boolean));
  }

  /** C# `AsEnumerable` — returns deferred query over same source. */
  AsEnumerable(): Query<T> {
    return new Query(this.source, this.pipeline);
  }

  Cast<R>(): Query<R> {
    return this.chain(castFeature.append!(this.pipeline));
  }

  Take(count: number): Query<T> {
    return this.chain(takeFeature.append!(this.pipeline, count));
  }

  Skip(count: number): Query<T> {
    return this.chain(skipFeature.append!(this.pipeline, count));
  }

  TakeWhile(predicate: Predicate<T>): Query<T> {
    return this.chain(takeWhileFeature.append!(this.pipeline, predicate));
  }

  SkipWhile(predicate: Predicate<T>): Query<T> {
    return this.chain(skipWhileFeature.append!(this.pipeline, predicate));
  }

  OrderBy<K>(keySelector: OrderKey<T, K>, options?: OrderByOptions): Query<T> {
    return this.chain(orderByFeature.append!(this.pipeline, keySelector, options ?? false));
  }

  OrderByDescending<K>(keySelector: OrderKey<T, K>, options?: Omit<OrderByOptions, 'descending'>): Query<T> {
    return this.chain(orderByDescendingFeature.append!(this.pipeline, keySelector, options));
  }

  ThenBy<K>(keySelector: OrderKey<T, K>, options?: OrderByOptions): Query<T> {
    return this.chain(thenByFeature.append!(this.pipeline, keySelector, options));
  }

  ThenByDescending<K>(keySelector: OrderKey<T, K>, options?: Omit<OrderByOptions, 'descending'>): Query<T> {
    return this.chain(thenByDescendingFeature.append!(this.pipeline, keySelector, options));
  }

  Reverse(): Query<T> {
    return this.chain(reverseFeature.append!(this.pipeline));
  }

  Distinct(comparer?: EqualityComparer<T>): Query<T> {
    return this.chain(distinctFeature.append!(this.pipeline, comparer));
  }

  DistinctBy<K>(keySelector: Selector<T, K>, comparer?: EqualityComparer<K>): Query<T> {
    return this.chain(distinctByFeature.append!(this.pipeline, keySelector, comparer));
  }

  GroupBy<K>(keySelector: Selector<T, K>): Query<IGrouping<K, T>>;
  GroupBy<K, E>(keySelector: Selector<T, K>, elementSelector: Selector<T, E>): Query<IGrouping<K, E>>;
  GroupBy<K, E>(
    keySelector: Selector<T, K>,
    elementSelector?: Selector<T, E>,
  ): Query<IGrouping<K, T | E>> {
    return this.chain(
      groupByFeature.append!(this.pipeline, keySelector, elementSelector),
    ) as unknown as Query<IGrouping<K, T | E>>;
  }

  Join<TInner, TKey, TResult>(
    inner: Iterable<TInner>,
    outerKeySelector: Selector<T, TKey>,
    innerKeySelector: Selector<TInner, TKey>,
    resultSelector: (outer: T, inner: TInner) => TResult,
    comparer?: EqualityComparer<TKey>,
  ): Query<TResult> {
    return this.chain(
      joinFeature.append!(
        this.pipeline,
        inner,
        outerKeySelector,
        innerKeySelector,
        resultSelector,
        comparer,
      ),
    );
  }

  GroupJoin<TInner, TKey, TResult>(
    inner: Iterable<TInner>,
    outerKeySelector: Selector<T, TKey>,
    innerKeySelector: Selector<TInner, TKey>,
    resultSelector: (outer: T, inner: Iterable<TInner>) => TResult,
    comparer?: EqualityComparer<TKey>,
  ): Query<TResult> {
    return this.chain(
      groupJoinFeature.append!(
        this.pipeline,
        inner,
        outerKeySelector,
        innerKeySelector,
        resultSelector,
        comparer,
      ),
    );
  }

  LeftJoin<TInner, TKey, TResult>(
    inner: Iterable<TInner>,
    outerKeySelector: Selector<T, TKey>,
    innerKeySelector: Selector<TInner, TKey>,
    resultSelector: (outer: T, inner: TInner | null) => TResult,
    comparer?: EqualityComparer<TKey>,
  ): Query<TResult> {
    return this.chain(
      leftJoinFeature.append!(
        this.pipeline,
        inner,
        outerKeySelector,
        innerKeySelector,
        resultSelector,
        comparer,
      ),
    );
  }

  RightJoin<TInner, TKey, TResult>(
    inner: Iterable<TInner>,
    outerKeySelector: Selector<T, TKey>,
    innerKeySelector: Selector<TInner, TKey>,
    resultSelector: (outer: T | null, inner: TInner) => TResult,
    comparer?: EqualityComparer<TKey>,
  ): Query<TResult> {
    return this.chain(
      rightJoinFeature.append!(
        this.pipeline,
        inner,
        outerKeySelector,
        innerKeySelector,
        resultSelector,
        comparer,
      ),
    );
  }

  FullJoin<TInner, TKey, TResult>(
    inner: Iterable<TInner>,
    outerKeySelector: Selector<T, TKey>,
    innerKeySelector: Selector<TInner, TKey>,
    resultSelector: (outer: T | null, inner: TInner | null) => TResult,
    comparer?: EqualityComparer<TKey>,
  ): Query<TResult> {
    return this.chain(
      fullJoinFeature.append!(
        this.pipeline,
        inner,
        outerKeySelector,
        innerKeySelector,
        resultSelector,
        comparer,
      ),
    );
  }

  GroupByMany(...keySelectors: Selector<T, unknown>[]): Query<IGrouping<unknown[], T>> {
    return this.GroupBy((item, index) => keySelectors.map((sel) => sel(item, index)));
  }

  Page(page: number, pageSize: number): Query<T> {
    const skip = (Math.max(1, page) - 1) * pageSize;
    return this.Skip(skip).Take(pageSize);
  }

  WhereEq(path: objectPredicates.PathOrKey<T>, value: unknown): Query<T> {
    return this.Where(objectPredicates.whereEq(path, value));
  }

  WhereNotEq(path: objectPredicates.PathOrKey<T>, value: unknown): Query<T> {
    return this.Where(objectPredicates.whereNotEq(path, value));
  }

  WhereGt(path: objectPredicates.PathOrKey<T>, value: number | string | Date): Query<T> {
    return this.Where(objectPredicates.whereGt(path, value));
  }

  WhereGte(path: objectPredicates.PathOrKey<T>, value: number | string | Date): Query<T> {
    return this.Where(objectPredicates.whereGte(path, value));
  }

  WhereLt(path: objectPredicates.PathOrKey<T>, value: number | string | Date): Query<T> {
    return this.Where(objectPredicates.whereLt(path, value));
  }

  WhereLte(path: objectPredicates.PathOrKey<T>, value: number | string | Date): Query<T> {
    return this.Where(objectPredicates.whereLte(path, value));
  }

  WhereIn(path: objectPredicates.PathOrKey<T>, values: readonly unknown[]): Query<T> {
    return this.Where(objectPredicates.whereIn(path, values));
  }

  WhereNotIn(path: objectPredicates.PathOrKey<T>, values: readonly unknown[]): Query<T> {
    return this.Where(objectPredicates.whereNotIn(path, values));
  }

  WhereBetween(
    path: objectPredicates.PathOrKey<T>,
    min: number | string | Date,
    max: number | string | Date,
  ): Query<T> {
    return this.Where(objectPredicates.whereBetween(path, min, max));
  }

  WhereContains(path: objectPredicates.PathOrKey<T>, substring: string, insensitive = false): Query<T> {
    return this.Where(objectPredicates.whereContains(path, substring, insensitive));
  }

  WhereStartsWith(path: objectPredicates.PathOrKey<T>, prefix: string, insensitive = false): Query<T> {
    return this.Where(objectPredicates.whereStartsWith(path, prefix, insensitive));
  }

  WhereEndsWith(path: objectPredicates.PathOrKey<T>, suffix: string, insensitive = false): Query<T> {
    return this.Where(objectPredicates.whereEndsWith(path, suffix, insensitive));
  }

  WhereNull(path: objectPredicates.PathOrKey<T>): Query<T> {
    return this.Where(objectPredicates.whereNull(path));
  }

  WhereNotNull(path: objectPredicates.PathOrKey<T>): Query<T> {
    return this.Where(objectPredicates.whereNotNull(path));
  }

  WhereTruthy(path: objectPredicates.PathOrKey<T>): Query<T> {
    return this.Where(objectPredicates.whereTruthy(path));
  }

  WhereFalsy(path: objectPredicates.PathOrKey<T>): Query<T> {
    return this.Where(objectPredicates.whereFalsy(path));
  }

  Pluck<K extends objectPredicates.PathOrKey<T>>(path: K): Query<unknown> {
    return this.Select(objectPredicates.pluck(path));
  }

  SelectKeys<K extends keyof T>(this: Query<T & object>, ...keys: K[]): Query<Pick<T, K>> {
    return this.Select(objectPredicates.selectKeys(keys)) as unknown as Query<Pick<T, K>>;
  }

  OmitKeys<K extends keyof T>(this: Query<T & object>, ...keys: K[]): Query<Omit<T, K>> {
    return this.Select(objectPredicates.omitKeys(keys)) as unknown as Query<Omit<T, K>>;
  }

  Explain(): ReturnType<typeof explainPipeline> {
    return explainPipeline(this.pipeline);
  }

  ExplainText(): string[] {
    return explainPipelineText(this.pipeline);
  }

  Zip<TSecond, TResult>(
    second: Iterable<TSecond>,
    resultSelector: (first: T, second: TSecond) => TResult,
  ): Query<TResult> {
    return this.chain(zipFeature.append!(this.pipeline, second, resultSelector));
  }

  Concat(second: Iterable<T>): Query<T> {
    return this.chain(concatFeature.append!(this.pipeline, second));
  }

  Union(second: Iterable<T>, comparer?: EqualityComparer<T>): Query<T> {
    return this.chain(unionFeature.append!(this.pipeline, second, comparer));
  }

  Intersect(second: Iterable<T>, comparer?: EqualityComparer<T>): Query<T> {
    return this.chain(intersectFeature.append!(this.pipeline, second, comparer));
  }

  Except(second: Iterable<T>, comparer?: EqualityComparer<T>): Query<T> {
    return this.chain(exceptFeature.append!(this.pipeline, second, comparer));
  }

  Chunk(size: number): Query<T[]> {
    return this.chain(chunkFeature.append!(this.pipeline, size));
  }

  Scan<TAccumulate>(
    seed: TAccumulate,
    func: (acc: TAccumulate, item: T, index: number) => TAccumulate,
  ): Query<TAccumulate> {
    return this.chain(scanFeature.append!(this.pipeline, seed, func));
  }

  DefaultIfEmpty(defaultValue: T): Query<T> {
    return this.chain(defaultIfEmptyFeature.append!(this.pipeline, defaultValue));
  }

  WithIndex(): Query<Indexed<T>> {
    return this.chain(withIndexFeature.append!(this.pipeline));
  }

  Buffer(size: number, step = 1): Query<T[]> {
    return this.chain(bufferFeature.append!(this.pipeline, size, step));
  }

  TryWhere(predicate: Predicate<T>): Query<T> {
    return this.chain(tryWhereFeature.append!(this.pipeline, predicate));
  }

  Pairwise(): Query<Pair<T>> {
    return this.chain(pairwiseFeature.append!(this.pipeline));
  }

  Tap(action: (item: T, index: number) => void): Query<T> {
    return this.chain(tapFeature.append!(this.pipeline, action));
  }

  Flatten<U>(this: Query<Iterable<U>>): Query<U> {
    return this.chain(
      flattenFeature.append!(this.pipeline as unknown as OpPipeline<Iterable<U>>),
    ) as Query<U>;
  }

  AdjacentDistinct(comparer?: EqualityComparer<T>): Query<T> {
    return this.chain(adjacentDistinctFeature.append!(this.pipeline, comparer));
  }

  Prepend(items: Iterable<T>): Query<T> {
    return this.chain(prependFeature.append!(this.pipeline, items));
  }

  Append(items: Iterable<T>): Query<T> {
    return this.chain(appendFeature.append!(this.pipeline, items));
  }

  Partition(predicate: Predicate<T>): [T[], T[]] {
    return partitionFeature.runSync!(this.source, this.pipeline, predicate);
  }

  SplitAt(index: number): [T[], T[]] {
    return splitAtFeature.runSync!(this.source, this.pipeline, index);
  }

  ToArray(): T[] {
    return toArrayFeature.runSync!(this.source, this.pipeline);
  }

  ToList(): T[] {
    return toListFeature.runSync!(this.source, this.pipeline);
  }

  ForEach(action: (item: T, index: number) => void): void {
    forEachFeature.runSync!(this.source, this.pipeline, action);
  }

  First(predicate?: Predicate<T>): T {
    return firstFeature.runSync!(this.source, this.pipeline, predicate);
  }

  FirstOrDefault(defaultValue: T, predicate?: Predicate<T>): T {
    return firstOrDefaultFeature.runSync!(this.source, this.pipeline, defaultValue, predicate);
  }

  Last(predicate?: Predicate<T>): T {
    return lastFeature.runSync!(this.source, this.pipeline, predicate);
  }

  LastOrDefault(defaultValue: T, predicate?: Predicate<T>): T {
    return lastOrDefaultFeature.runSync!(this.source, this.pipeline, defaultValue, predicate);
  }

  Single(predicate?: Predicate<T>): T {
    return singleFeature.runSync!(this.source, this.pipeline, predicate);
  }

  SingleOrDefault(defaultValue: T, predicate?: Predicate<T>): T {
    return singleOrDefaultFeature.runSync!(this.source, this.pipeline, defaultValue, predicate);
  }

  ElementAt(index: number): T {
    return elementAtFeature.runSync!(this.source, this.pipeline, index);
  }

  ElementAtOrDefault(index: number, defaultValue: T): T {
    return elementAtOrDefaultFeature.runSync!(this.source, this.pipeline, index, defaultValue);
  }

  Any(predicate?: Predicate<T>): boolean {
    return anyFeature.runSync!(this.source, this.pipeline, predicate);
  }

  All(predicate: Predicate<T>): boolean {
    return allFeature.runSync!(this.source, this.pipeline, predicate);
  }

  Contains(value: T, comparer?: EqualityComparer<T>): boolean {
    return containsFeature.runSync!(this.source, this.pipeline, value, comparer);
  }

  SequenceEqual(second: Iterable<T>, comparer?: EqualityComparer<T>): boolean {
    return sequenceEqualFeature.runSync!(this.source, this.pipeline, second, comparer);
  }

  Count(predicate?: Predicate<T>): number {
    return countFeature.runSync!(this.source, this.pipeline, predicate);
  }

  LongCount(): number {
    return longCountFeature.runSync!(this.source, this.pipeline);
  }

  Sum(): number;
  Sum(selector: Selector<T, number>): number;
  Sum(selector?: Selector<T, number>): number {
    return sumFeature.runSync!(this.source, this.pipeline, selector);
  }

  Min(): number;
  Min(selector: Selector<T, number>): number;
  Min(selector?: Selector<T, number>): number {
    return minFeature.runSync!(this.source, this.pipeline, selector);
  }

  Max(): number;
  Max(selector: Selector<T, number>): number;
  Max(selector?: Selector<T, number>): number {
    return maxFeature.runSync!(this.source, this.pipeline, selector);
  }

  Average(): number;
  Average(selector: Selector<T, number>): number;
  Average(selector?: Selector<T, number>): number {
    return averageFeature.runSync!(this.source, this.pipeline, selector);
  }

  Aggregate<TAccumulate>(
    seed: TAccumulate,
    func: (acc: TAccumulate, item: T, index: number) => TAccumulate,
  ): TAccumulate {
    return aggregateFeature.runSync!(this.source, this.pipeline, seed, func);
  }

  MinBy<TKey>(keySelector: Selector<T, TKey>): T {
    return minByFeature.runSync!(this.source, this.pipeline, keySelector);
  }

  MaxBy<TKey>(keySelector: Selector<T, TKey>): T {
    return maxByFeature.runSync!(this.source, this.pipeline, keySelector);
  }

  ToDictionary<TKey, TElement>(
    keySelector: Selector<T, TKey>,
    elementSelector?: Selector<T, TElement>,
  ): Map<TKey, TElement> {
    return toDictionaryFeature.runSync!(
      this.source,
      this.pipeline,
      keySelector,
      elementSelector,
    );
  }

  ToLookup<TKey, TElement>(
    keySelector: Selector<T, TKey>,
    elementSelector?: Selector<T, TElement>,
  ): Lookup<TKey, TElement> {
    return toLookupFeature.runSync!(this.source, this.pipeline, keySelector, elementSelector);
  }

  ToSet(): Set<T> {
    return toSetFeature.runSync!(this.source, this.pipeline);
  }

  /** C# `ToHashSet` alias for `ToSet`. */
  ToHashSet(): Set<T> {
    return this.ToSet();
  }

  ToMap<TKey, TElement>(
    keySelector: Selector<T, TKey>,
    elementSelector?: Selector<T, TElement>,
  ): Map<TKey, TElement> {
    return toMapFeature.runSync!(this.source, this.pipeline, keySelector, elementSelector);
  }

  ToObject<TKey extends string, TElement>(
    keySelector: Selector<T, TKey>,
    elementSelector?: Selector<T, TElement>,
  ): Record<TKey, TElement> {
    return toObjectFeature.runSync!(this.source, this.pipeline, keySelector, elementSelector);
  }

  Reduce(func: (acc: T, item: T, index: number) => T): T;
  Reduce<TAccumulate>(
    seed: TAccumulate,
    func: (acc: TAccumulate, item: T, index: number) => TAccumulate,
  ): TAccumulate;
  Reduce<TAccumulate>(
    seedOrFunc: TAccumulate | ((acc: T, item: T, index: number) => T),
    func?: (acc: TAccumulate, item: T, index: number) => TAccumulate,
  ): T | TAccumulate {
    return reduceFeature.runSync!(this.source, this.pipeline, seedOrFunc, func);
  }

  FirstOrThrow(predicate?: Predicate<T>): T {
    return firstOrThrowFeature.runSync!(this.source, this.pipeline, predicate);
  }

  LastOrThrow(predicate?: Predicate<T>): T {
    return lastOrThrowFeature.runSync!(this.source, this.pipeline, predicate);
  }

  SingleOrThrow(predicate?: Predicate<T>): T {
    return singleOrThrowFeature.runSync!(this.source, this.pipeline, predicate);
  }

  Median(selector?: Selector<T, number>): number {
    return medianFeature.runSync!(this.source, this.pipeline, selector);
  }

  Mode<TKey>(keySelector?: Selector<T, TKey>): TKey | T {
    return modeFeature.runSync!(this.source, this.pipeline, keySelector);
  }

  Percentile(percentile: number, selector?: Selector<T, number>): number {
    return percentileFeature.runSync!(this.source, this.pipeline, percentile, selector);
  }

  CountBy<TKey>(keySelector: Selector<T, TKey>): Map<TKey, number> {
    return countByFeature.runSync!(this.source, this.pipeline, keySelector);
  }

  Paginate(page: number, pageSize: number, maxPageSize?: number): PageResult<T> {
    return paginateFeature.runSync!(this.source, this.pipeline, page, pageSize, maxPageSize);
  }

  CursorPage(pageSize: number, cursor?: string, maxPageSize?: number): CursorPageResult<T> {
    return cursorPageFeature.runSync!(this.source, this.pipeline, pageSize, cursor, maxPageSize);
  }

  Index(): Query<[number, T]> {
    return this.chain(indexFeature.append!(this.pipeline)) as unknown as Query<[number, T]>;
  }

  TakeLast(count: number): Query<T> {
    return this.chain(takeLastFeature.append!(this.pipeline, count));
  }

  SkipLast(count: number): Query<T> {
    return this.chain(skipLastFeature.append!(this.pipeline, count));
  }

  Order(options?: OrderByOptions): Query<T> {
    return this.chain(orderFeature.append!(this.pipeline, options));
  }

  OrderDescending(options?: Omit<OrderByOptions, 'descending'>): Query<T> {
    return this.chain(orderDescendingFeature.append!(this.pipeline, options));
  }

  AggregateBy<K, A>(
    keySelector: Selector<T, K>,
    seed: A | ((item: T) => A),
    func: (acc: A, item: T) => A,
    comparer?: EqualityComparer<K>,
  ): Query<[K, A]> {
    return this.chain(
      aggregateByFeature.append!(this.pipeline, keySelector, seed, func, comparer),
    ) as unknown as Query<[K, A]>;
  }

  UnionBy<K>(
    second: Iterable<T>,
    keySelector: Selector<T, K>,
    comparer?: EqualityComparer<K>,
  ): Query<T> {
    return this.chain(unionByFeature.append!(this.pipeline, second, keySelector, comparer));
  }

  IntersectBy<K>(
    second: Iterable<K>,
    keySelector: Selector<T, K>,
    comparer?: EqualityComparer<K>,
  ): Query<T> {
    return this.chain(intersectByFeature.append!(this.pipeline, second, keySelector, comparer));
  }

  ExceptBy<K>(
    second: Iterable<K>,
    keySelector: Selector<T, K>,
    comparer?: EqualityComparer<K>,
  ): Query<T> {
    return this.chain(exceptByFeature.append!(this.pipeline, second, keySelector, comparer));
  }
}
