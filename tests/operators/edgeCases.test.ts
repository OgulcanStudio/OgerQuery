import { describe, it, expect } from 'vitest';
import {
  Q,
  QAsync,
  Empty,
  Range,
  Repeat,
  EmptySequenceError,
  MoreThanOneElementError,
  ArgumentOutOfRangeError,
  InvalidOperationError,
  Grouping,
  Lookup,
} from '../../src/index.js';
import { bufferFeature } from '../../src/features/lazy/Buffer.js';
import { chunkFeature } from '../../src/features/lazy/Chunk.js';

describe('OgerQuery Edge Cases', () => {
  describe('Lazy Operators', () => {
    it('AsEnumerable and ToHashSet', () => {
      const data = [1, 2, 2, 3];
      expect(Q(data).AsEnumerable().Distinct().ToArray()).toEqual([1, 2, 3]);
      expect(Q(data).ToHashSet()).toEqual(new Set([1, 2, 3]));
    });

    it('Where edge cases', () => {
      // Empty input
      expect(Q([]).Where(() => true).ToArray()).toEqual([]);
      // Predicate relying on index
      expect(Q([10, 20, 30]).Where((x, i) => i === 1).ToArray()).toEqual([20]);
      // Predicate that filters out everything
      expect(Q([1, 2, 3]).Where(x => x > 10).ToArray()).toEqual([]);
    });

    it('Select edge cases', () => {
      // Mapping to null and undefined
      expect(Q([1, 2]).Select(() => null).ToArray()).toEqual([null, null]);
      expect(Q([1, 2]).Select(() => undefined).ToArray()).toEqual([undefined, undefined]);
      // Projection changing types
      expect(Q([1, 2]).Select(x => ({ val: String(x) })).ToArray()).toEqual([
        { val: '1' },
        { val: '2' },
      ]);
      // Selector relying on index
      expect(Q([10, 20]).Select((x, i) => x + (i ?? 0)).ToArray()).toEqual([10, 21]);
    });

    it('SelectMany edge cases', () => {
      // Empty sub-iterables
      expect(Q([[1, 2], [], [3]]).SelectMany(x => x).ToArray()).toEqual([1, 2, 3]);
      // Generator mappings
      expect(
        Q([1, 2])
          .SelectMany(function* (x) {
            yield x;
            yield x * 10;
          })
          .ToArray()
      ).toEqual([1, 10, 2, 20]);
      // Empty input
      expect(Q([]).SelectMany((x: number[]) => x).ToArray()).toEqual([]);
      // Selector relying on index
      expect(Q([[10], [20]]).SelectMany((x, i) => x.map(v => v + (i ?? 0))).ToArray()).toEqual([10, 21]);
    });

    it('OfType & Cast edge cases', () => {
      class Account { constructor(public id: number) {} }
      class Tx { constructor(public id: number) {} }
      const ledger = [new Account(1), new Tx(2), 3, null];
      expect(
        Q(ledger).OfType((x): x is Account => x instanceof Account).ToArray(),
      ).toEqual([new Account(1)]);

      const mixed = [1, 'a', { x: 1 }, null, undefined, [2], true, Symbol('s')];
      // OfType should filter to non-null, non-undefined objects
      expect(Q(mixed).OfType().ToArray()).toEqual([{ x: 1 }, [2]]);
      // Cast should be runtime identity
      expect(Q([1, 'a']).Cast<number>().ToArray()).toEqual([1, 'a']);
    });

    it('Take edge cases', () => {
      // Negative count should throw RangeError
      expect(() => Q([1, 2]).Take(-1)).toThrow(RangeError);
      // Take 0
      expect(Q([1, 2]).Take(0).ToArray()).toEqual([]);
      // Take 0 with generator source (covers executeSync count <= 0)
      expect(Q((function*(){ yield 1; })()).Take(0).ToArray()).toEqual([]);
      // Take more than size
      expect(Q([1, 2]).Take(10).ToArray()).toEqual([1, 2]);
      // Infinite stream take
      function* infinite() {
        let i = 0;
        while (true) yield i++;
      }
      expect(Q(infinite()).Take(3).ToArray()).toEqual([0, 1, 2]);
    });

    it('Skip edge cases', () => {
      // Negative count should throw RangeError
      expect(() => Q([1, 2]).Skip(-1)).toThrow(RangeError);
      // Skip 0
      expect(Q([1, 2]).Skip(0).ToArray()).toEqual([1, 2]);
      // Skip more than size
      expect(Q([1, 2]).Skip(10).ToArray()).toEqual([]);
    });

    it('TakeWhile edge cases', () => {
      // Immediately false
      expect(Q([1, 2, 3]).TakeWhile(x => x > 5).ToArray()).toEqual([]);
      // Never false
      expect(Q([1, 2]).TakeWhile(() => true).ToArray()).toEqual([1, 2]);
      // Index checking
      expect(Q([10, 20, 30]).TakeWhile((x, i) => (i ?? 0) < 2).ToArray()).toEqual([10, 20]);
    });

    it('SkipWhile edge cases', () => {
      // Immediately false
      expect(Q([1, 2, 3]).SkipWhile(x => x > 5).ToArray()).toEqual([1, 2, 3]);
      // Never false
      expect(Q([1, 2]).SkipWhile(() => true).ToArray()).toEqual([]);
      // Index checking
      expect(Q([10, 20, 30]).SkipWhile((x, i) => (i ?? 0) < 2).ToArray()).toEqual([30]);
    });

    it('DefaultIfEmpty edge cases', () => {
      // Empty input returns default
      expect(Q<number>([]).DefaultIfEmpty(99).ToArray()).toEqual([99]);
      // Non-empty input ignores default
      expect(Q([1, 2]).DefaultIfEmpty(99).ToArray()).toEqual([1, 2]);
      // Null is a valid default
      expect(Q<number | null>([]).DefaultIfEmpty(null).ToArray()).toEqual([null]);
    });

    it('Chunk edge cases', () => {
      // Size <= 0 should throw RangeError
      expect(() => Q([1, 2]).Chunk(0)).toThrow(RangeError);
      expect(() => Q([1, 2]).Chunk(-5)).toThrow(RangeError);
      // Direct call to executeSync with size <= 0
      expect(() => [...chunkFeature.executeSync!([], { kind: 'chunk', size: 0 })]).toThrow(RangeError);
      // Size > array length
      expect(Q([1, 2]).Chunk(5).ToArray()).toEqual([[1, 2]]);
      // Size exact divisor
      expect(Q([1, 2, 3, 4]).Chunk(2).ToArray()).toEqual([[1, 2], [3, 4]]);
      // Size 1
      expect(Q([1, 2]).Chunk(1).ToArray()).toEqual([[1], [2]]);
    });

    it('Scan edge cases', () => {
      // Empty input yields seed only
      expect(Q([]).Scan(10, (acc, x) => acc + x).ToArray()).toEqual([10]);
      // Seed undefined/null
      expect(Q([1, 2]).Scan(null as any, (acc, x) => (acc || 0) + x).ToArray()).toEqual([null, 1, 3]);
      // Index check
      expect(Q([10, 20]).Scan(0, (acc, x, i) => acc + i).ToArray()).toEqual([0, 0, 1]);
    });

    it('WithIndex edge cases', () => {
      expect(Q(['a', 'b']).WithIndex().ToArray()).toEqual([
        { value: 'a', index: 0 },
        { value: 'b', index: 1 },
      ]);
      expect(Q([]).WithIndex().ToArray()).toEqual([]);
    });

    it('Buffer edge cases', () => {
      // Negative/zero size/step throws RangeError
      expect(() => Q([1, 2]).Buffer(0, 1)).toThrow(RangeError);
      // Direct call to executeSync with size <= 0
      expect(() => [...bufferFeature.executeSync!([], { size: 0, step: 1 })]).toThrow(RangeError);
      // Direct call to executeSync with step <= 0
      expect(() => [...bufferFeature.executeSync!([], { size: 1, step: 0 })]).toThrow(RangeError);
      expect(() => Q([1, 2]).Buffer(2, 0)).toThrow(RangeError);
      // Window size larger than source
      expect(Q([1, 2]).Buffer(3, 1).ToArray()).toEqual([]);
      // Step larger than size - behaves as step=size (2) in this library structure
      expect(Q([1, 2, 3, 4, 5]).Buffer(2, 3).ToArray()).toEqual([[1, 2], [3, 4]]);
    });

    it('TryWhere edge cases', () => {
      // Predicate throws on some elements
      const pred = (x: number) => {
        if (x === 2) throw new Error('boom');
        return x % 2 === 0;
      };
      expect(Q([1, 2, 3, 4]).TryWhere(pred).ToArray()).toEqual([4]);
      // Predicate throws on all elements
      expect(Q([1, 2]).TryWhere(() => { throw new Error(); }).ToArray()).toEqual([]);
    });

    it('Pairwise edge cases', () => {
      expect(Q([]).Pairwise().ToArray()).toEqual([]);
      expect(Q([1]).Pairwise().ToArray()).toEqual([]);
      expect(Q([1, 2]).Pairwise().ToArray()).toEqual([[1, 2]]);
      expect(Q([1, 2, 3]).Pairwise().ToArray()).toEqual([[1, 2], [2, 3]]);
    });

    it('Tap edge cases', () => {
      // Tap runs lazily
      const list: number[] = [];
      const query = Q([1, 2]).Tap(x => list.push(x));
      expect(list).toEqual([]);
      query.ToArray();
      expect(list).toEqual([1, 2]);
    });

    it('Flatten edge cases', () => {
      // Nested empty/null-like elements
      expect(Q([[], [1], [], [2, 3]] as any[]).Flatten().ToArray()).toEqual([1, 2, 3]);
      // Set/Map nested elements
      expect(Q([new Set([1]), new Map([['a', 2]].map(x => [x[0], x[1]])) as any] as any[]).Flatten().ToArray()).toEqual([1, ['a', 2]]);
    });

    it('AdjacentDistinct edge cases', () => {
      // Consecutive nulls and undefined
      expect(Q([null, null, undefined, undefined, null]).AdjacentDistinct().ToArray()).toEqual([null, undefined, null]);
      // Custom case-insensitive comparer
      expect(
        Q(['a', 'A', 'b', 'b', 'B'])
          .AdjacentDistinct((x, y) => x.toLowerCase() === y.toLowerCase())
          .ToArray()
      ).toEqual(['a', 'b']);
    });

    it('Prepend & Append edge cases', () => {
      const gen = function* () { yield 3; yield 4; };
      expect(Q([1, 2]).Prepend(gen()).ToArray()).toEqual([3, 4, 1, 2]);
      expect(Q([1, 2]).Append(gen()).ToArray()).toEqual([1, 2, 3, 4]);
      expect(Q([]).Prepend([]).ToArray()).toEqual([]);
    });

    it('Index edge cases', () => {
      expect(Q(['a', 'b']).Index().ToArray()).toEqual([
        [0, 'a'],
        [1, 'b'],
      ]);
      expect(Q([]).Index().ToArray()).toEqual([]);
    });

    it('TakeLast & SkipLast edge cases', () => {
      // TakeLast <= 0
      expect(Q([1, 2]).TakeLast(0).ToArray()).toEqual([]);
      expect(Q([1, 2]).TakeLast(-5).ToArray()).toEqual([]);
      // TakeLast > length
      expect(Q([1, 2]).TakeLast(5).ToArray()).toEqual([1, 2]);

      // SkipLast <= 0
      expect(Q([1, 2]).SkipLast(0).ToArray()).toEqual([1, 2]);
      expect(Q([1, 2]).SkipLast(-5).ToArray()).toEqual([1, 2]);
      // SkipLast > length
      expect(Q([1, 2]).SkipLast(5).ToArray()).toEqual([]);
    });
  });

  describe('Materializing Operators', () => {
    it('OrderBy, OrderByDescending, ThenBy, ThenByDescending stable sorting & edge cases', () => {
      // Stable sort verification (original index preserved for ties)
      const users = [
        { name: 'Amy', role: 'User', age: 25 },
        { name: 'Josh', role: 'Admin', age: 30 },
        { name: 'Dave', role: 'User', age: 25 },
      ];
      // Sort by age (ascending), original order should keep Amy before Dave
      const sortedByAge = Q(users).OrderBy(x => x.age).ToArray();
      expect(sortedByAge[0]?.name).toBe('Amy');
      expect(sortedByAge[1]?.name).toBe('Dave');

      // Sorting null/undefined values (nulls strategy)
      const nulls = [3, null, 1, undefined, 2];
      // default is 'last'
      expect(Q(nulls).OrderBy(x => x).ToArray()).toEqual([1, 2, 3, null, undefined]);
      // nulls first
      expect(Q(nulls).OrderBy(x => x, { nulls: 'first' }).ToArray()).toEqual([null, undefined, 1, 2, 3]);

      // localeCompare
      const special = ['ä', 'z', 'a'];
      expect(Q(special).OrderBy(x => x, { localeCompare: 'de' }).ToArray()).toEqual(['a', 'ä', 'z']);

      // ThenBy secondary sorting
      const secondarySorted = Q(users)
        .OrderBy(x => x.role)
        .ThenByDescending(x => x.age)
        .ToArray();
      // Admin: Josh (30)
      // User: Dave (25), Amy (25) -> since role is User and age is 25 for both, stability keeps original order (Amy, Dave)
      expect(secondarySorted.map(u => u.name)).toEqual(['Josh', 'Amy', 'Dave']);

      // OrderByDescending with Take (triggers heap optimization)
      const numbers = [5, 1, 4, 2, 3];
      expect(Q(numbers).OrderByDescending(x => x).Take(3).ToArray()).toEqual([5, 4, 3]);

      // Compound OrderByDescending and ThenBy with Take
      const items = [
        { active: true, amount: 2 },
        { active: false, amount: 1 },
        { active: true, amount: 1 },
        { active: false, amount: 2 }
      ];
      const compoundSorted = Q(items)
        .OrderByDescending(x => x.active)
        .ThenBy(x => x.amount)
        .Take(3)
        .ToArray();
      expect(compoundSorted).toEqual([
        { active: true, amount: 1 },
        { active: true, amount: 2 },
        { active: false, amount: 1 }
      ]);

      // Small array heap optimization test cases
      expect(Q([5]).OrderBy(x => x).Take(1).ToArray()).toEqual([5]);
      expect(Q([5, 6]).OrderBy(x => x).Take(1).ToArray()).toEqual([5]);
      expect(Q([5, 6]).OrderBy(x => x).Take(2).ToArray()).toEqual([5, 6]);
      expect(Q([]).OrderBy(x => x).Take(1).ToArray()).toEqual([]);
    });

    it('Async OrderBy optimizations (Take, First, Last)', async () => {
      expect(await QAsync([5]).OrderBy(x => x).Take(1).ToArrayAsync()).toEqual([5]);
      expect(await QAsync([5, 6]).OrderBy(x => x).Take(1).ToArrayAsync()).toEqual([5]);
      expect(await QAsync([5, 6]).OrderBy(x => x).Take(2).ToArrayAsync()).toEqual([5, 6]);
      expect(await QAsync([]).OrderBy(x => x).Take(1).ToArrayAsync()).toEqual([]);

      expect(await QAsync([5, 1, 4]).OrderBy(x => x).FirstAsync()).toEqual(1);
      expect(await QAsync([5, 1, 4]).OrderBy(x => x).LastAsync()).toEqual(5);
    });

    it('Reverse edge cases', () => {
      expect(Q([]).Reverse().ToArray()).toEqual([]);
      expect(Q([1]).Reverse().ToArray()).toEqual([1]);
      expect(Q([1, 2, 3]).Reverse().ToArray()).toEqual([3, 2, 1]);
    });

    it('Distinct & DistinctBy edge cases', () => {
      // null and undefined duplicates
      expect(Q([null, null, undefined, undefined]).Distinct().ToArray()).toEqual([null, undefined]);
      // DistinctBy custom comparer
      const items = [{ k: 'a', v: 1 }, { k: 'A', v: 2 }, { k: 'b', v: 3 }];
      expect(
        Q(items)
          .DistinctBy(
            x => x.k,
            (a, b) => a.toLowerCase() === b.toLowerCase()
          )
          .ToArray()
      ).toEqual([{ k: 'a', v: 1 }, { k: 'b', v: 3 }]);
    });

    it('GroupBy edge cases', () => {
      // Grouping empty source
      expect(Q([]).GroupBy(x => x).ToArray()).toEqual([]);
      // Grouping by null/undefined key
      const items = [
        { id: 1, key: null },
        { id: 2, key: null },
        { id: 3, key: undefined },
      ];
      const groups = Q(items).GroupBy(x => x.key).ToArray();
      expect(groups.length).toBe(2);
      expect([...(groups.find(g => g.key === null) ?? [])].length).toBe(2);
      expect([...(groups.find(g => g.key === undefined) ?? [])].length).toBe(1);
    });

    it('Join, GroupJoin, LeftJoin, RightJoin, FullJoin edge cases', () => {
      const outer = [{ id: 1, val: 'o1' }, { id: 2, val: 'o2' }];
      const inner = [{ id: 2, val: 'i2' }, { id: 3, val: 'i3' }];

      // Join: only matching keys (2)
      expect(
        Q(outer)
          .Join(
            inner,
            o => o.id,
            i => i.id,
            (o, i) => `${o.val}-${i.val}`
          )
          .ToArray()
      ).toEqual(['o2-i2']);

      // GroupJoin
      const groupJoin = Q(outer)
        .GroupJoin(
          inner,
          o => o.id,
          i => i.id,
          (o, iGroup) => ({ o: o.val, iCount: [...iGroup].length })
        )
        .ToArray();
      expect(groupJoin).toEqual([
        { o: 'o1', iCount: 0 },
        { o: 'o2', iCount: 1 },
      ]);

      const keyComparer = (a: any, b: any) => a === b;

      // LeftJoin (null for missing inner match)
      expect(
        Q(outer)
          .LeftJoin(
            inner,
            o => o.id,
            i => i.id,
            (o, i) => `${o.val}-${i ? i.val : 'null'}`,
            keyComparer
          )
          .ToArray()
      ).toEqual(['o1-null', 'o2-i2']);

      // RightJoin (null for missing outer match)
      expect(
        Q(outer)
          .RightJoin(
            inner,
            o => o.id,
            i => i.id,
            (o, i) => `${o ? o.val : 'null'}-${i.val}`,
            keyComparer
          )
          .ToArray()
      ).toEqual(['o2-i2', 'null-i3']);

      // FullJoin (null for any missing match)
      expect(
        Q(outer)
          .FullJoin(
            inner,
            o => o.id,
            i => i.id,
            (o, i) => `${o ? o.val : 'null'}-${i ? i.val : 'null'}`,
            keyComparer
          )
          .ToArray()
      ).toEqual(['o1-null', 'o2-i2', 'null-i3']);
    });

    it('Zip edge cases', () => {
      // Unequal lengths (truncation)
      expect(Q([1, 2, 3]).Zip([10, 20], (a, b) => a + b).ToArray()).toEqual([11, 22]);
      expect(Q([1]).Zip([10, 20], (a, b) => a + b).ToArray()).toEqual([11]);
      // Empty zip
      expect(Q([]).Zip([1], (a, b) => a).ToArray()).toEqual([]);
    });

    it('Concat, Union, UnionBy, Intersect, IntersectBy, Except, ExceptBy edge cases', () => {
      const empty: number[] = [];
      const comparer = (a: any, b: any) => a === b;
      const keyComparer = (a: any, b: any) => a === b;

      // Concat
      expect(Q([1]).Concat(empty).ToArray()).toEqual([1]);
      // Union
      expect(Q([1, 2]).Union([2, 3], comparer).ToArray()).toEqual([1, 2, 3]);
      // UnionBy with custom comparer and duplicate keys inside source to cover duplicate branch
      expect(
        Q([{ id: 1 }, { id: 1 }, { id: 2 }])
          .UnionBy([{ id: 2 }, { id: 3 }], x => x.id, keyComparer)
          .ToArray()
      ).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);

      // Intersect
      expect(Q([1, 2, 2, 3]).Intersect([2, 3], comparer).ToArray()).toEqual([2, 3]);
      // IntersectBy
      expect(
        Q([{ id: 1 }, { id: 2 }])
          .IntersectBy([2, 3], x => x.id, keyComparer)
          .ToArray()
      ).toEqual([{ id: 2 }]);

      // Except
      expect(Q([1, 2]).Except([2, 3], comparer).ToArray()).toEqual([1]);
      // ExceptBy
      expect(
        Q([{ id: 1 }, { id: 2 }])
          .ExceptBy([2, 3], x => x.id, keyComparer)
          .ToArray()
      ).toEqual([{ id: 1 }]);
    });

    it('Order & OrderDescending edge cases', () => {
      const numbers = [3, 1, 2];
      expect(Q(numbers).Order().ToArray()).toEqual([1, 2, 3]);
      expect(Q(numbers).OrderDescending().ToArray()).toEqual([3, 2, 1]);
    });

    it('AggregateBy edge cases', () => {
      // Empty input
      expect(Q([]).AggregateBy(x => x, 0, (acc, item) => acc + item).ToArray()).toEqual([]);
      // AggregateBy grouping and counting occurrences with generator function seed
      const fruits = ['apple', 'banana', 'apple'];
      expect(
        Q(fruits)
          .AggregateBy(
            x => x,
            () => ({ count: 0 }),
            (acc, item) => {
              acc.count++;
              return acc;
            }
          )
          .ToArray()
      ).toEqual([
        ['apple', { count: 2 }],
        ['banana', { count: 1 }],
      ]);

      // Custom comparer with static seed (covers AggregateBy line 36 static seed branch)
      expect(
        Q(fruits)
          .AggregateBy(
            x => x,
            0,
            (acc, item) => acc + 1,
            (k1, k2) => k1.toLowerCase() === k2.toLowerCase()
          )
          .ToArray()
      ).toEqual([
        ['apple', 2],
        ['banana', 1],
      ]);
    });
  });

  describe('Terminal Operators', () => {
    it('ToArray & ToList edge cases', () => {
      function* gen() { yield 1; yield 2; }
      expect(Q(gen()).ToArray()).toEqual([1, 2]);
      expect(Q(gen()).ToList()).toEqual([1, 2]);
      expect(Q([]).ToArray()).toEqual([]);
    });

    it('ForEach edge cases', () => {
      const items: number[] = [];
      Q([10, 20]).ForEach((x, i) => items.push(x + i));
      expect(items).toEqual([10, 21]);
    });

    it('First, FirstOrDefault, FirstOrThrow edge cases', () => {
      expect(Q([1, 2]).First()).toBe(1);
      expect(Q([1, 2]).First(x => x > 1)).toBe(2);
      expect(() => Q([]).First()).toThrow();
      expect(() => Q([1, 2]).First(x => x > 10)).toThrow();

      expect(Q([1, 2]).FirstOrDefault(99)).toBe(1);
      expect(Q([1, 2]).FirstOrDefault(99, x => x > 10)).toBe(99);

      expect(Q([1, 2]).FirstOrThrow()).toBe(1);
      expect(() => Q([]).FirstOrThrow()).toThrow();
    });

    it('Last, LastOrDefault, LastOrThrow edge cases', () => {
      expect(Q([1, 2]).Last()).toBe(2);
      expect(Q([1, 2]).Last(x => x < 2)).toBe(1);
      expect(() => Q([]).Last()).toThrow();
      expect(() => Q([1, 2]).Last(x => x > 10)).toThrow();

      expect(Q([1, 2]).LastOrDefault(99)).toBe(2);
      expect(Q([1, 2]).LastOrDefault(99, x => x > 10)).toBe(99);

      expect(Q([1, 2]).LastOrThrow()).toBe(2);
      expect(() => Q([]).LastOrThrow()).toThrow();
    });

    it('Single, SingleOrDefault, SingleOrThrow edge cases', () => {
      expect(Q([1]).Single()).toBe(1);
      expect(() => Q([]).Single()).toThrow(EmptySequenceError);
      expect(() => Q([1, 2]).Single()).toThrow(MoreThanOneElementError);
      expect(Q([1, 2]).Single(x => x === 2)).toBe(2);
      expect(() => Q([1, 2]).Single(x => x > 0)).toThrow(MoreThanOneElementError);

      expect(Q([1]).SingleOrDefault(99)).toBe(1);
      expect(Q<number>([]).SingleOrDefault(99)).toBe(99);
      expect(() => Q([1, 2]).SingleOrDefault(99)).toThrow(MoreThanOneElementError);

      expect(Q([1]).SingleOrThrow()).toBe(1);
      expect(() => Q([]).SingleOrThrow()).toThrow();
    });

    it('ElementAt & ElementAtOrDefault edge cases', () => {
      expect(Q([10, 20]).ElementAt(1)).toBe(20);
      expect(() => Q([10, 20]).ElementAt(-1)).toThrow(ArgumentOutOfRangeError);
      expect(() => Q([10, 20]).ElementAt(5)).toThrow(ArgumentOutOfRangeError);

      expect(Q([10, 20]).ElementAtOrDefault(1, 99)).toBe(20);
      expect(Q([10, 20]).ElementAtOrDefault(5, 99)).toBe(99);
      expect(Q([10, 20]).ElementAtOrDefault(-1, 99)).toBe(99);
    });

    it('Any & All edge cases', () => {
      // Any empty sequence
      expect(Q([]).Any()).toBe(false);
      // All empty sequence (always true)
      expect(Q([]).All(() => false)).toBe(true);

      // Short circuit verification
      let callCount = 0;
      Q([1, 2, 3]).Any(x => {
        callCount++;
        return x === 2;
      });
      expect(callCount).toBe(2); // Short circuits at 2
    });

    it('Contains & SequenceEqual edge cases', () => {
      // Contains custom comparer
      const items = [{ id: 1 }, { id: 2 }];
      expect(Q(items).Contains({ id: 1 }, (a, b) => a.id === b.id)).toBe(true);

      // SequenceEqual different sizes
      expect(Q([1, 2]).SequenceEqual([1, 2, 3])).toBe(false);
      // SequenceEqual empty
      expect(Q([]).SequenceEqual([])).toBe(true);
    });

    it('Count & LongCount edge cases', () => {
      expect(Q([]).Count()).toBe(0);
      expect(Q([1, 2, 3]).Count(x => x > 1)).toBe(2);
      expect(Q([1, 2]).LongCount()).toBe(2);
    });

    it('Sum, Min, Max, Average edge cases', () => {
      // Empty sequences check (Min, Max, Average throw, Sum returns 0)
      expect(Q([]).Sum()).toBe(0);
      expect(() => Q([]).Min()).toThrow(EmptySequenceError);
      expect(() => Q([]).Max()).toThrow(EmptySequenceError);
      expect(() => Q([]).Average()).toThrow(EmptySequenceError);

      // Selector checks
      const objs = [{ v: 10 }, { v: 20 }];
      expect(Q(objs).Sum(x => x.v)).toBe(30);
      expect(Q(objs).Min(x => x.v)).toBe(10);
      expect(Q(objs).Max(x => x.v)).toBe(20);
      expect(Q(objs).Average(x => x.v)).toBe(15);
    });

    it('Aggregate & Reduce edge cases', () => {
      // Aggregate with seed on empty returns seed
      expect(Q<number>([]).Aggregate(10, (acc, x) => acc + x)).toBe(10);

      // Reduce throws on empty
      expect(() => Q<number>([]).Reduce((acc, x) => acc + x)).toThrow(EmptySequenceError);
      // Reduce with 1 element returns it without executing func
      let executed = false;
      expect(Q([10]).Reduce((acc, x) => { executed = true; return acc + x; })).toBe(10);
      expect(executed).toBe(false);
    });

    it('MinBy & MaxBy edge cases', () => {
      expect(() => Q<number>([]).MinBy(x => x)).toThrow(EmptySequenceError);
      expect(() => Q<number>([]).MaxBy(x => x)).toThrow(EmptySequenceError);

      // Duplicate match returns first
      const items = [{ id: 1, v: 5 }, { id: 2, v: 5 }];
      expect(Q(items).MinBy(x => x.v)).toEqual({ id: 1, v: 5 });
    });

    it('ToDictionary, ToLookup, ToSet, ToMap, ToObject edge cases', () => {
      // ToDictionary duplicate key throws
      expect(() => Q([1, 1]).ToDictionary(x => x)).toThrow();
      expect(Q([1, 2]).ToSet()).toEqual(new Set([1, 2]));

      // ToLookup missing key returns empty group
      const lookup = Q([{ k: 'a', v: 1 }]).ToLookup(x => x.k);
      expect([...lookup.get('b')]).toEqual([]);

      // ToObject empty
      expect(Q<any>([]).ToObject(x => 'k')).toEqual({});
    });

    it('Partition & SplitAt edge cases', () => {
      // Partition all matches vs none matches
      expect(Q([1, 2]).Partition(x => x > 0)).toEqual([[1, 2], []]);
      expect(Q([1, 2]).Partition(x => x < 0)).toEqual([[], [1, 2]]);

      // SplitAt out of range
      expect(Q([10, 20]).SplitAt(5)).toEqual([[10, 20], []]);
      expect(() => Q([10, 20]).SplitAt(-1)).toThrow(RangeError);
      expect(Q([10, 20]).SplitAt(1)).toEqual([[10], [20]]);
    });

    it('Median, Mode, Percentile edge cases', () => {
      // Even/odd length Median
      expect(Q([1, 3, 2]).Median()).toBe(2);
      expect(Q([1, 4, 3, 2]).Median()).toBe(2.5);
      expect(() => Q([]).Median()).toThrow(EmptySequenceError);

      // Mode empty vs single mode vs ties
      expect(() => Q([]).Mode()).toThrow(EmptySequenceError);
      expect(Q([1, 2, 2, 3]).Mode()).toBe(2);

      // Percentile range
      expect(() => Q([1]).Percentile(-1)).toThrow(ArgumentOutOfRangeError);
      expect(() => Q([1]).Percentile(101)).toThrow(ArgumentOutOfRangeError);
      expect(() => Q([]).Percentile(50)).toThrow(EmptySequenceError);
    });

    it('CountBy edge cases', () => {
      expect(Q(['a', 'b', 'a', null, null]).CountBy(x => x)).toEqual(
        new Map([
          ['a', 2],
          ['b', 1],
          [null, 2],
        ])
      );
    });

    it('Paginate & CursorPage edge cases', () => {
      const pageResult = Q([1, 2, 3]).Paginate(1, 2, 10);
      expect(pageResult.items).toEqual([1, 2]);
      expect(pageResult.totalPages).toBe(2);

      // Paginate with NaN page fallback
      expect(Q([1, 2, 3]).Paginate(NaN, 2).page).toBe(1);

      // CursorPage
      const cursorResult = Q([1, 2, 3]).CursorPage(2);
      expect(cursorResult.items).toEqual([1, 2]);
      expect(cursorResult.nextCursor).toBeDefined();

      // CursorPage with invalid cursor fallback
      expect(Q([1, 2, 3]).CursorPage(2, 'abc').items).toEqual([1, 2]);
    });
  });

  describe('Executor Fast Paths & Fallbacks', () => {
    it('covers all specialized 2-op and 3-op array fast paths and early exit take branches', () => {
      const arr = [1, 2, 3, 4, 5];

      // 2-op Where + Select (where returns false)
      expect(
        Q(arr)
          .Where(x => x % 2 === 0)
          .Select(x => x * 10)
          .ToArray()
      ).toEqual([20, 40]);

      // 2-op Where + Take (where returns false, take limits)
      expect(
        Q(arr)
          .Where(x => x % 2 !== 0)
          .Take(2)
          .ToArray()
      ).toEqual([1, 3]);

      // 2-op Select + Take (take limits)
      expect(
        Q(arr)
          .Select(x => x * 2)
          .Take(2)
          .ToArray()
      ).toEqual([2, 4]);

      // 3-op Where + Select + Take (where returns false, take limits)
      expect(
        Q(arr)
          .Where(x => x % 2 !== 0)
          .Select(x => x * 10)
          .Take(2)
          .ToArray()
      ).toEqual([10, 30]);

      // 3-op Where + Skip + Take (where returns false, skip skips, take limits)
      expect(
        Q(arr)
          .Where(x => x % 2 !== 0)
          .Skip(1)
          .Take(2)
          .ToArray()
      ).toEqual([3, 5]);

      // 4-op fallback path (Where + Select + Skip + Take)
      expect(
        Q(arr)
          .Where(x => x % 2 !== 0)
          .Select(x => x * 10)
          .Skip(1)
          .Take(1)
          .ToArray()
      ).toEqual([30]);

      // Fallback path with Take(0) (covers executor.ts line 227)
      expect(
        Q(arr)
          .Where(x => true)
          .Select(x => x)
          .Skip(0)
          .Take(0)
          .ToArray()
      ).toEqual([]);

      // Fallback path with double Take separated by Skip (covers executor.ts line 221)
      expect(
        Q(arr)
          .Take(1)
          .Skip(0)
          .Take(2)
          .ToArray()
      ).toEqual([1]);
    });
  });
});
