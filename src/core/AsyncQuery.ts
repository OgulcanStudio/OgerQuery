import type { PageResult, CursorPageResult } from '../pagination/types.js';
import * as objectPredicates from '../helpers/predicates.js';
import { explainPipeline, explainPipelineText } from '../debug/explain.js';
import { executeAsyncPipeline } from './asyncExecutor.js';
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

export class AsyncQuery<T> implements AsyncIterable<T> {
  constructor(
    private readonly source: AsyncIterable<T>,
    readonly pipeline: OpPipeline<T> = new OpPipeline(),
  ) {}

  private chain<R>(pipeline: OpPipeline<R>): AsyncQuery<R> {
    return new AsyncQuery(this.source as unknown as AsyncIterable<R>, pipeline);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    yield* executeAsyncPipeline(this.source, this.pipeline);
  }

  Where(predicate: Predicate<T>): AsyncQuery<T> {
    return this.chain(whereFeature.append!(this.pipeline, predicate));
  }

  Select<R>(selector: Selector<T, R>): AsyncQuery<R> {
    return this.chain(selectFeature.append!(this.pipeline, selector)) as AsyncQuery<R>;
  }

  SelectMany<R>(selector: Selector<T, Iterable<R>>): AsyncQuery<R> {
    return this.chain(selectManyFeature.append!(this.pipeline, selector));
  }

  OfType<R extends T>(guard?: (item: T) => item is R): AsyncQuery<R> {
    return this.chain(ofTypeFeature.append!(this.pipeline, guard as (item: unknown) => boolean));
  }

  AsEnumerable(): AsyncQuery<T> {
    return new AsyncQuery(this.source, this.pipeline);
  }

  Cast<R>(): AsyncQuery<R> {
    return this.chain(castFeature.append!(this.pipeline));
  }

  Take(count: number): AsyncQuery<T> {
    return this.chain(takeFeature.append!(this.pipeline, count));
  }

  Skip(count: number): AsyncQuery<T> {
    return this.chain(skipFeature.append!(this.pipeline, count));
  }

  TakeWhile(predicate: Predicate<T>): AsyncQuery<T> {
    return this.chain(takeWhileFeature.append!(this.pipeline, predicate));
  }

  SkipWhile(predicate: Predicate<T>): AsyncQuery<T> {
    return this.chain(skipWhileFeature.append!(this.pipeline, predicate));
  }

  OrderBy<K>(keySelector: OrderKey<T, K>, options?: OrderByOptions): AsyncQuery<T> {
    return this.chain(orderByFeature.append!(this.pipeline, keySelector, options ?? false));
  }

  OrderByDescending<K>(keySelector: OrderKey<T, K>, options?: Omit<OrderByOptions, 'descending'>): AsyncQuery<T> {
    return this.chain(orderByDescendingFeature.append!(this.pipeline, keySelector, options));
  }

  ThenBy<K>(keySelector: OrderKey<T, K>, options?: OrderByOptions): AsyncQuery<T> {
    return this.chain(thenByFeature.append!(this.pipeline, keySelector, options));
  }

  ThenByDescending<K>(keySelector: OrderKey<T, K>, options?: Omit<OrderByOptions, 'descending'>): AsyncQuery<T> {
    return this.chain(thenByDescendingFeature.append!(this.pipeline, keySelector, options));
  }

  Reverse(): AsyncQuery<T> {
    return this.chain(reverseFeature.append!(this.pipeline));
  }

  Distinct(comparer?: EqualityComparer<T>): AsyncQuery<T> {
    return this.chain(distinctFeature.append!(this.pipeline, comparer));
  }

  DistinctBy<K>(keySelector: Selector<T, K>, comparer?: EqualityComparer<K>): AsyncQuery<T> {
    return this.chain(distinctByFeature.append!(this.pipeline, keySelector, comparer));
  }

  GroupBy<K>(keySelector: Selector<T, K>): AsyncQuery<IGrouping<K, T>>;
  GroupBy<K, E>(keySelector: Selector<T, K>, elementSelector: Selector<T, E>): AsyncQuery<IGrouping<K, E>>;
  GroupBy<K, E>(
    keySelector: Selector<T, K>,
    elementSelector?: Selector<T, E>,
  ): AsyncQuery<IGrouping<K, T | E>> {
    return this.chain(
      groupByFeature.append!(this.pipeline, keySelector, elementSelector),
    ) as unknown as AsyncQuery<IGrouping<K, T | E>>;
  }

  Join<TInner, TKey, TResult>(
    inner: Iterable<TInner> | AsyncIterable<TInner>,
    outerKeySelector: Selector<T, TKey>,
    innerKeySelector: Selector<TInner, TKey>,
    resultSelector: (outer: T, inner: TInner) => TResult,
    comparer?: EqualityComparer<TKey>,
  ): AsyncQuery<TResult> {
    return this.chain(
      joinFeature.append!(
        this.pipeline,
        inner as Iterable<TInner>,
        outerKeySelector,
        innerKeySelector,
        resultSelector,
        comparer,
      ),
    );
  }

  GroupJoin<TInner, TKey, TResult>(
    inner: Iterable<TInner> | AsyncIterable<TInner>,
    outerKeySelector: Selector<T, TKey>,
    innerKeySelector: Selector<TInner, TKey>,
    resultSelector: (outer: T, inner: Iterable<TInner>) => TResult,
    comparer?: EqualityComparer<TKey>,
  ): AsyncQuery<TResult> {
    return this.chain(
      groupJoinFeature.append!(
        this.pipeline,
        inner as Iterable<TInner>,
        outerKeySelector,
        innerKeySelector,
        resultSelector,
        comparer,
      ),
    );
  }

  LeftJoin<TInner, TKey, TResult>(
    inner: Iterable<TInner> | AsyncIterable<TInner>,
    outerKeySelector: Selector<T, TKey>,
    innerKeySelector: Selector<TInner, TKey>,
    resultSelector: (outer: T, inner: TInner | null) => TResult,
    comparer?: EqualityComparer<TKey>,
  ): AsyncQuery<TResult> {
    return this.chain(
      leftJoinFeature.append!(
        this.pipeline,
        inner as Iterable<TInner>,
        outerKeySelector,
        innerKeySelector,
        resultSelector,
        comparer,
      ),
    );
  }

  RightJoin<TInner, TKey, TResult>(
    inner: Iterable<TInner> | AsyncIterable<TInner>,
    outerKeySelector: Selector<T, TKey>,
    innerKeySelector: Selector<TInner, TKey>,
    resultSelector: (outer: T | null, inner: TInner) => TResult,
    comparer?: EqualityComparer<TKey>,
  ): AsyncQuery<TResult> {
    return this.chain(
      rightJoinFeature.append!(
        this.pipeline,
        inner as Iterable<TInner>,
        outerKeySelector,
        innerKeySelector,
        resultSelector,
        comparer,
      ),
    );
  }

  FullJoin<TInner, TKey, TResult>(
    inner: Iterable<TInner> | AsyncIterable<TInner>,
    outerKeySelector: Selector<T, TKey>,
    innerKeySelector: Selector<TInner, TKey>,
    resultSelector: (outer: T | null, inner: TInner | null) => TResult,
    comparer?: EqualityComparer<TKey>,
  ): AsyncQuery<TResult> {
    return this.chain(
      fullJoinFeature.append!(
        this.pipeline,
        inner as Iterable<TInner>,
        outerKeySelector,
        innerKeySelector,
        resultSelector,
        comparer,
      ),
    );
  }

  GroupByMany(...keySelectors: Selector<T, unknown>[]): AsyncQuery<IGrouping<unknown[], T>> {
    return this.GroupBy((item, index) => keySelectors.map((sel) => sel(item, index)));
  }

  Page(page: number, pageSize: number): AsyncQuery<T> {
    const skip = (Math.max(1, page) - 1) * pageSize;
    return this.Skip(skip).Take(pageSize);
  }

  WhereEq(path: objectPredicates.PathOrKey<T>, value: unknown): AsyncQuery<T> {
    return this.Where(objectPredicates.whereEq(path, value));
  }

  WhereNotEq(path: objectPredicates.PathOrKey<T>, value: unknown): AsyncQuery<T> {
    return this.Where(objectPredicates.whereNotEq(path, value));
  }

  WhereGt(path: objectPredicates.PathOrKey<T>, value: number | string | Date): AsyncQuery<T> {
    return this.Where(objectPredicates.whereGt(path, value));
  }

  WhereGte(path: objectPredicates.PathOrKey<T>, value: number | string | Date): AsyncQuery<T> {
    return this.Where(objectPredicates.whereGte(path, value));
  }

  WhereLt(path: objectPredicates.PathOrKey<T>, value: number | string | Date): AsyncQuery<T> {
    return this.Where(objectPredicates.whereLt(path, value));
  }

  WhereLte(path: objectPredicates.PathOrKey<T>, value: number | string | Date): AsyncQuery<T> {
    return this.Where(objectPredicates.whereLte(path, value));
  }

  WhereIn(path: objectPredicates.PathOrKey<T>, values: readonly unknown[]): AsyncQuery<T> {
    return this.Where(objectPredicates.whereIn(path, values));
  }

  WhereNotIn(path: objectPredicates.PathOrKey<T>, values: readonly unknown[]): AsyncQuery<T> {
    return this.Where(objectPredicates.whereNotIn(path, values));
  }

  WhereBetween(
    path: objectPredicates.PathOrKey<T>,
    min: number | string | Date,
    max: number | string | Date,
  ): AsyncQuery<T> {
    return this.Where(objectPredicates.whereBetween(path, min, max));
  }

  WhereContains(path: objectPredicates.PathOrKey<T>, substring: string, insensitive = false): AsyncQuery<T> {
    return this.Where(objectPredicates.whereContains(path, substring, insensitive));
  }

  WhereStartsWith(path: objectPredicates.PathOrKey<T>, prefix: string, insensitive = false): AsyncQuery<T> {
    return this.Where(objectPredicates.whereStartsWith(path, prefix, insensitive));
  }

  WhereEndsWith(path: objectPredicates.PathOrKey<T>, suffix: string, insensitive = false): AsyncQuery<T> {
    return this.Where(objectPredicates.whereEndsWith(path, suffix, insensitive));
  }

  WhereNull(path: objectPredicates.PathOrKey<T>): AsyncQuery<T> {
    return this.Where(objectPredicates.whereNull(path));
  }

  WhereNotNull(path: objectPredicates.PathOrKey<T>): AsyncQuery<T> {
    return this.Where(objectPredicates.whereNotNull(path));
  }

  WhereTruthy(path: objectPredicates.PathOrKey<T>): AsyncQuery<T> {
    return this.Where(objectPredicates.whereTruthy(path));
  }

  WhereFalsy(path: objectPredicates.PathOrKey<T>): AsyncQuery<T> {
    return this.Where(objectPredicates.whereFalsy(path));
  }

  Pluck<K extends objectPredicates.PathOrKey<T>>(path: K): AsyncQuery<unknown> {
    return this.Select(objectPredicates.pluck(path));
  }

  SelectKeys<K extends keyof T>(this: AsyncQuery<T & object>, ...keys: K[]): AsyncQuery<Pick<T, K>> {
    return this.Select(objectPredicates.selectKeys(keys)) as unknown as AsyncQuery<Pick<T, K>>;
  }

  OmitKeys<K extends keyof T>(this: AsyncQuery<T & object>, ...keys: K[]): AsyncQuery<Omit<T, K>> {
    return this.Select(objectPredicates.omitKeys(keys)) as unknown as AsyncQuery<Omit<T, K>>;
  }

  Explain(): ReturnType<typeof explainPipeline> {
    return explainPipeline(this.pipeline);
  }

  ExplainText(): string[] {
    return explainPipelineText(this.pipeline);
  }

  Zip<TSecond, TResult>(
    second: Iterable<TSecond> | AsyncIterable<TSecond>,
    resultSelector: (first: T, second: TSecond) => TResult,
  ): AsyncQuery<TResult> {
    return this.chain(zipFeature.append!(this.pipeline, second as Iterable<TSecond>, resultSelector));
  }

  Concat(second: Iterable<T> | AsyncIterable<T>): AsyncQuery<T> {
    return this.chain(concatFeature.append!(this.pipeline, second));
  }

  Union(second: Iterable<T> | AsyncIterable<T>, comparer?: EqualityComparer<T>): AsyncQuery<T> {
    return this.chain(unionFeature.append!(this.pipeline, second, comparer));
  }

  Intersect(
    second: Iterable<T> | AsyncIterable<T>,
    comparer?: EqualityComparer<T>,
  ): AsyncQuery<T> {
    return this.chain(intersectFeature.append!(this.pipeline, second, comparer));
  }

  Except(second: Iterable<T> | AsyncIterable<T>, comparer?: EqualityComparer<T>): AsyncQuery<T> {
    return this.chain(exceptFeature.append!(this.pipeline, second, comparer));
  }

  Chunk(size: number): AsyncQuery<T[]> {
    return this.chain(chunkFeature.append!(this.pipeline, size));
  }

  Scan<TAccumulate>(
    seed: TAccumulate,
    func: (acc: TAccumulate, item: T, index: number) => TAccumulate,
  ): AsyncQuery<TAccumulate> {
    return this.chain(scanFeature.append!(this.pipeline, seed, func));
  }

  DefaultIfEmpty(defaultValue: T): AsyncQuery<T> {
    return this.chain(defaultIfEmptyFeature.append!(this.pipeline, defaultValue));
  }

  WithIndex(): AsyncQuery<Indexed<T>> {
    return this.chain(withIndexFeature.append!(this.pipeline));
  }

  Buffer(size: number, step = 1): AsyncQuery<T[]> {
    return this.chain(bufferFeature.append!(this.pipeline, size, step));
  }

  TryWhere(predicate: Predicate<T>): AsyncQuery<T> {
    return this.chain(tryWhereFeature.append!(this.pipeline, predicate));
  }

  Pairwise(): AsyncQuery<Pair<T>> {
    return this.chain(pairwiseFeature.append!(this.pipeline));
  }

  Tap(action: (item: T, index: number) => void): AsyncQuery<T> {
    return this.chain(tapFeature.append!(this.pipeline, action));
  }

  Flatten<U>(this: AsyncQuery<Iterable<U>>): AsyncQuery<U> {
    return this.chain(
      flattenFeature.append!(this.pipeline as unknown as OpPipeline<Iterable<U>>),
    ) as AsyncQuery<U>;
  }

  AdjacentDistinct(comparer?: EqualityComparer<T>): AsyncQuery<T> {
    return this.chain(adjacentDistinctFeature.append!(this.pipeline, comparer));
  }

  Prepend(items: Iterable<T>): AsyncQuery<T> {
    return this.chain(prependFeature.append!(this.pipeline, items));
  }

  Append(items: Iterable<T>): AsyncQuery<T> {
    return this.chain(appendFeature.append!(this.pipeline, items));
  }

  PartitionAsync(predicate: Predicate<T>): Promise<[T[], T[]]> {
    return partitionFeature.runAsync!(this.source, this.pipeline, predicate);
  }

  SplitAtAsync(index: number): Promise<[T[], T[]]> {
    return splitAtFeature.runAsync!(this.source, this.pipeline, index);
  }

  ToArrayAsync(): Promise<T[]> {
    return toArrayFeature.runAsync!(this.source, this.pipeline);
  }

  ToListAsync(): Promise<T[]> {
    return toListFeature.runAsync!(this.source, this.pipeline);
  }

  ForEachAsync(
    action: (item: T, index: number) => void | Promise<void>,
    options?: { concurrency?: number; signal?: AbortSignal },
  ): Promise<void> {
    return forEachFeature.runAsync!(this.source, this.pipeline, action, options);
  }

  FirstAsync(predicate?: Predicate<T>): Promise<T> {
    return firstFeature.runAsync!(this.source, this.pipeline, predicate);
  }

  FirstOrDefaultAsync(defaultValue: T, predicate?: Predicate<T>): Promise<T> {
    return firstOrDefaultFeature.runAsync!(
      this.source,
      this.pipeline,
      defaultValue,
      predicate,
    );
  }

  LastAsync(predicate?: Predicate<T>): Promise<T> {
    return lastFeature.runAsync!(this.source, this.pipeline, predicate);
  }

  LastOrDefaultAsync(defaultValue: T, predicate?: Predicate<T>): Promise<T> {
    return lastOrDefaultFeature.runAsync!(
      this.source,
      this.pipeline,
      defaultValue,
      predicate,
    );
  }

  SingleAsync(predicate?: Predicate<T>): Promise<T> {
    return singleFeature.runAsync!(this.source, this.pipeline, predicate);
  }

  SingleOrDefaultAsync(defaultValue: T, predicate?: Predicate<T>): Promise<T> {
    return singleOrDefaultFeature.runAsync!(
      this.source,
      this.pipeline,
      defaultValue,
      predicate,
    );
  }

  ElementAtAsync(index: number): Promise<T> {
    return elementAtFeature.runAsync!(this.source, this.pipeline, index);
  }

  ElementAtOrDefaultAsync(index: number, defaultValue: T): Promise<T> {
    return elementAtOrDefaultFeature.runAsync!(
      this.source,
      this.pipeline,
      index,
      defaultValue,
    );
  }

  AnyAsync(predicate?: Predicate<T>): Promise<boolean> {
    return anyFeature.runAsync!(this.source, this.pipeline, predicate);
  }

  AllAsync(predicate: Predicate<T>): Promise<boolean> {
    return allFeature.runAsync!(this.source, this.pipeline, predicate);
  }

  ContainsAsync(value: T, comparer?: EqualityComparer<T>): Promise<boolean> {
    return containsFeature.runAsync!(this.source, this.pipeline, value, comparer);
  }

  SequenceEqualAsync(
    second: AsyncIterable<T> | Iterable<T>,
    comparer?: EqualityComparer<T>,
  ): Promise<boolean> {
    return sequenceEqualFeature.runAsync!(this.source, this.pipeline, second, comparer);
  }

  CountAsync(predicate?: Predicate<T>): Promise<number> {
    return countFeature.runAsync!(this.source, this.pipeline, predicate);
  }

  LongCountAsync(): Promise<number> {
    return longCountFeature.runAsync!(this.source, this.pipeline);
  }

  SumAsync(): Promise<number>;
  SumAsync(selector: Selector<T, number>): Promise<number>;
  SumAsync(selector?: Selector<T, number>): Promise<number> {
    return sumFeature.runAsync!(this.source, this.pipeline, selector);
  }

  MinAsync(): Promise<number>;
  MinAsync(selector: Selector<T, number>): Promise<number>;
  MinAsync(selector?: Selector<T, number>): Promise<number> {
    return minFeature.runAsync!(this.source, this.pipeline, selector);
  }

  MaxAsync(): Promise<number>;
  MaxAsync(selector: Selector<T, number>): Promise<number>;
  MaxAsync(selector?: Selector<T, number>): Promise<number> {
    return maxFeature.runAsync!(this.source, this.pipeline, selector);
  }

  AverageAsync(): Promise<number>;
  AverageAsync(selector: Selector<T, number>): Promise<number>;
  AverageAsync(selector?: Selector<T, number>): Promise<number> {
    return averageFeature.runAsync!(this.source, this.pipeline, selector);
  }

  AggregateAsync<TAccumulate>(
    seed: TAccumulate,
    func: (acc: TAccumulate, item: T, index: number) => TAccumulate,
  ): Promise<TAccumulate> {
    return aggregateFeature.runAsync!(this.source, this.pipeline, seed, func);
  }

  MinByAsync<TKey>(keySelector: Selector<T, TKey>): Promise<T> {
    return minByFeature.runAsync!(this.source, this.pipeline, keySelector);
  }

  MaxByAsync<TKey>(keySelector: Selector<T, TKey>): Promise<T> {
    return maxByFeature.runAsync!(this.source, this.pipeline, keySelector);
  }

  ToDictionaryAsync<TKey, TElement>(
    keySelector: Selector<T, TKey>,
    elementSelector?: Selector<T, TElement>,
  ): Promise<Map<TKey, TElement>> {
    return toDictionaryFeature.runAsync!(
      this.source,
      this.pipeline,
      keySelector,
      elementSelector,
    );
  }

  ToLookupAsync<TKey, TElement>(
    keySelector: Selector<T, TKey>,
    elementSelector?: Selector<T, TElement>,
  ): Promise<Lookup<TKey, TElement>> {
    return toLookupFeature.runAsync!(this.source, this.pipeline, keySelector, elementSelector);
  }

  ToSetAsync(): Promise<Set<T>> {
    return toSetFeature.runAsync!(this.source, this.pipeline);
  }

  ToHashSetAsync(): Promise<Set<T>> {
    return this.ToSetAsync();
  }

  ToMapAsync<TKey, TElement>(
    keySelector: Selector<T, TKey>,
    elementSelector?: Selector<T, TElement>,
  ): Promise<Map<TKey, TElement>> {
    return toMapFeature.runAsync!(this.source, this.pipeline, keySelector, elementSelector);
  }

  ToObjectAsync<TKey extends string, TElement>(
    keySelector: Selector<T, TKey>,
    elementSelector?: Selector<T, TElement>,
  ): Promise<Record<TKey, TElement>> {
    return toObjectFeature.runAsync!(this.source, this.pipeline, keySelector, elementSelector);
  }

  ReduceAsync(func: (acc: T, item: T, index: number) => T): Promise<T>;
  ReduceAsync<TAccumulate>(
    seed: TAccumulate,
    func: (acc: TAccumulate, item: T, index: number) => TAccumulate,
  ): Promise<TAccumulate>;
  ReduceAsync<TAccumulate>(
    seedOrFunc: TAccumulate | ((acc: T, item: T, index: number) => T),
    func?: (acc: TAccumulate, item: T, index: number) => TAccumulate,
  ): Promise<T | TAccumulate> {
    return reduceFeature.runAsync!(this.source, this.pipeline, seedOrFunc, func);
  }

  FirstOrThrowAsync(predicate?: Predicate<T>): Promise<T> {
    return firstOrThrowFeature.runAsync!(this.source, this.pipeline, predicate);
  }

  LastOrThrowAsync(predicate?: Predicate<T>): Promise<T> {
    return lastOrThrowFeature.runAsync!(this.source, this.pipeline, predicate);
  }

  SingleOrThrowAsync(predicate?: Predicate<T>): Promise<T> {
    return singleOrThrowFeature.runAsync!(this.source, this.pipeline, predicate);
  }

  MedianAsync(selector?: Selector<T, number>): Promise<number> {
    return medianFeature.runAsync!(this.source, this.pipeline, selector);
  }

  ModeAsync<TKey>(keySelector?: Selector<T, TKey>): Promise<TKey | T> {
    return modeFeature.runAsync!(this.source, this.pipeline, keySelector);
  }

  PercentileAsync(percentile: number, selector?: Selector<T, number>): Promise<number> {
    return percentileFeature.runAsync!(this.source, this.pipeline, percentile, selector);
  }

  CountByAsync<TKey>(keySelector: Selector<T, TKey>): Promise<Map<TKey, number>> {
    return countByFeature.runAsync!(this.source, this.pipeline, keySelector);
  }

  PaginateAsync(page: number, pageSize: number, maxPageSize?: number): Promise<PageResult<T>> {
    return paginateFeature.runAsync!(
      this.source,
      this.pipeline,
      page,
      pageSize,
      maxPageSize,
    );
  }

  CursorPageAsync(
    pageSize: number,
    cursor?: string,
    maxPageSize?: number,
  ): Promise<CursorPageResult<T>> {
    return cursorPageFeature.runAsync!(
      this.source,
      this.pipeline,
      pageSize,
      cursor,
      maxPageSize,
    );
  }

  Index(): AsyncQuery<[number, T]> {
    return this.chain(indexFeature.append!(this.pipeline)) as unknown as AsyncQuery<[number, T]>;
  }

  TakeLast(count: number): AsyncQuery<T> {
    return this.chain(takeLastFeature.append!(this.pipeline, count));
  }

  SkipLast(count: number): AsyncQuery<T> {
    return this.chain(skipLastFeature.append!(this.pipeline, count));
  }

  Order(options?: OrderByOptions): AsyncQuery<T> {
    return this.chain(orderFeature.append!(this.pipeline, options));
  }

  OrderDescending(options?: Omit<OrderByOptions, 'descending'>): AsyncQuery<T> {
    return this.chain(orderDescendingFeature.append!(this.pipeline, options));
  }

  AggregateBy<K, A>(
    keySelector: Selector<T, K>,
    seed: A | ((item: T) => A),
    func: (acc: A, item: T) => A,
    comparer?: EqualityComparer<K>,
  ): AsyncQuery<[K, A]> {
    return this.chain(
      aggregateByFeature.append!(this.pipeline, keySelector, seed, func, comparer),
    ) as unknown as AsyncQuery<[K, A]>;
  }

  UnionBy<K>(
    second: Iterable<T> | AsyncIterable<T>,
    keySelector: Selector<T, K>,
    comparer?: EqualityComparer<K>,
  ): AsyncQuery<T> {
    return this.chain(unionByFeature.append!(this.pipeline, second as Iterable<T>, keySelector, comparer));
  }

  IntersectBy<K>(
    second: Iterable<K> | AsyncIterable<K>,
    keySelector: Selector<T, K>,
    comparer?: EqualityComparer<K>,
  ): AsyncQuery<T> {
    return this.chain(intersectByFeature.append!(this.pipeline, second as Iterable<K>, keySelector, comparer));
  }

  ExceptBy<K>(
    second: Iterable<K> | AsyncIterable<K>,
    keySelector: Selector<T, K>,
    comparer?: EqualityComparer<K>,
  ): AsyncQuery<T> {
    return this.chain(exceptByFeature.append!(this.pipeline, second as Iterable<K>, keySelector, comparer));
  }
}
