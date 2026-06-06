import { describe, it, expect } from 'vitest';
import { executeAsyncPipeline } from '../../src/core/asyncExecutor.js';
import {
  executePipeline,
  materialize,
  toIterable,
  wrapLazy,
} from '../../src/core/executor.js';
import { OpPipeline } from '../../src/core/OpPipeline.js';
import {
  canUseArrayFastPath,
  isLazyFusableOp,
  isMaterializingOp,
  isMaterializingOpAt,
} from '../../src/core/pipelineOps.js';
import { InvalidOperationError } from '../../src/index.js';
import type { PipelineOp } from '../../src/core/pipelineOps.js';
import { Q, QAsync } from '../../src/index.js';
import { compareWith } from '../../src/utils/comparer.js';
import { users } from '../helpers/fixtures.js';

import { whereFeature } from '../../src/features/lazy/Where.js';
import { selectFeature } from '../../src/features/lazy/Select.js';
import { takeFeature } from '../../src/features/lazy/Take.js';
import { skipFeature } from '../../src/features/lazy/Skip.js';
import { distinctFeature } from '../../src/features/materializing/Distinct.js';
import { distinctByFeature } from '../../src/features/materializing/DistinctBy.js';
import { groupByFeature } from '../../src/features/materializing/GroupBy.js';
import { firstOrDefaultFeature } from '../../src/features/terminal/FirstOrDefault.js';
import { lastOrDefaultFeature } from '../../src/features/terminal/LastOrDefault.js';

// Ensure features are registered
import '../../src/features/registry.js';

describe('coverage gaps', () => {
  it('pipelineOps helpers', () => {
    expect(isMaterializingOp({ kind: 'orderBy', keys: [] })).toBe(true);
    expect(isMaterializingOp({ kind: 'where', predicate: () => true })).toBe(false);
    expect(isMaterializingOpAt([], 0)).toBe(false);
    expect(isLazyFusableOp({ kind: 'take', count: 1 })).toBe(true);
    expect(canUseArrayFastPath([{ kind: 'where', predicate: () => true }])).toBe(true);
    expect(canUseArrayFastPath([{ kind: 'reverse' }])).toBe(false);
    expect(
      Q([1, 2, 3, 4])
        .Where((x) => x > 0)
        .Select((x) => x)
        .Skip(1)
        .Take(2)
        .ToArray(),
    ).toEqual([2, 3]);
    expect(Q([1, 2, 3]).Take(0).ToArray()).toEqual([]);
    const skipTake = takeFeature.append!(skipFeature.append!(new OpPipeline<number>(), 1), 2);
    expect([...toIterable([1, 2, 3, 4], skipTake)]).toEqual([2, 3]);
    expect(Q([1, 2, 3, 4]).Skip(2).ToArray()).toEqual([3, 4]);
    expect(new OpPipeline().isEmpty()).toBe(true);
  });

  it('wrapLazy default branch', () => {
    const unknownOp = { kind: 'unknown' } as PipelineOp<number>;
    const result = [...wrapLazy([1, 2], unknownOp)];
    expect(result).toEqual([1, 2]);
  });

  it('toIterable', () => {
    const p = whereFeature.append!(new OpPipeline<number>(), (x) => x > 0);
    expect([...toIterable([-1, 1, 2], p)]).toEqual([1, 2]);
  });

  it('distinct with comparer and join comparer', () => {
    expect(Q([1, 1, 2]).Distinct((a, b) => a === b).ToArray()).toEqual([1, 2]);
    const outer = [{ k: 'a' }];
    const inner = [{ k: 'A' }];
    expect(
      Q(outer)
        .Join(
          inner,
          (o) => o.k,
          (i) => i.k,
          (o, i) => o.k + i.k,
          (a, b) => a.toLowerCase() === b.toLowerCase(),
        )
        .ToArray(),
    ).toEqual(['aA']);
    expect(
      Q([{ k: 1 }, { k: 1 }])
        .Join(
          [{ k: 1 }, { k: 1 }],
          (o) => o.k,
          (i) => i.k,
          (o, i) => o.k + i.k,
        )
        .Count(),
    ).toBe(4);
  });

  it('groupBy elementSelector and skip fusion', () => {
    const groups = Q(users).GroupBy(
      (u) => u.name,
      (u) => u.email,
    );
    expect(groups.Count()).toBe(2);
    expect(groups.First().toArray().every((e) => typeof e === 'string')).toBe(true);
    let p = new OpPipeline<number>();
    p = skipFeature.append!(p, 1);
    p = skipFeature.append!(p, 2);
    expect(p.ops[0]).toEqual({ kind: 'skip', count: 3 });
  });

  it('distinctBy and groupJoin with optional comparer', () => {
    expect(Q(users).DistinctBy((u) => u.name, (a, b) => a === b).Count()).toBe(2);
    const gj = Q([
      { id: 1 },
      { id: 2 },
    ]).GroupJoin(
      [{ id: 1 }, { id: 1 }],
      (o) => o.id,
      (i) => i.id,
      (o, g) => [...g].length,
      (a, b) => a === b,
    );
    expect(gj.ToArray()).toEqual([2, 0]);
  });

  it('Last with predicate and terminal errors', () => {
    expect(Q(users).Last((u) => u.active).name).toBe('Josh');
    expect(new InvalidOperationError('x').name).toBe('InvalidOperationError');
    expect(() => Q([]).Last((u) => u.active)).toThrow();
  });

  it('ElementAt negative and empty All', () => {
    expect(() => Q(users).ElementAt(-1)).toThrow();
    expect(Q(users).ElementAtOrDefault(-1, users[0]!)).toEqual(users[0]!);
    expect(Q([1, 2, 3]).Any((x) => x > 2)).toBe(true);
    expect(Q([1, 2]).SequenceEqual([1, 2, 3])).toBe(false);
    expect(Q([]).All(() => true)).toBe(true);
    expect(Q(users).Contains(users[0]!, (a, b) => a.id === b.id)).toBe(true);
    expect(Q(users).Contains(users[0]!, () => false)).toBe(false);
    expect(Q([1, 2, 3]).Any((x, i) => i === 2 && x === 3)).toBe(true);
    expect(() => Q([]).MaxBy((x: number) => x)).toThrow();
    expect(() => Q([]).MinBy((x: number) => x)).toThrow();
    expect(
      Q([
        { v: 2 },
        { v: 1 },
      ]).MinBy((x) => x.v).v,
    ).toBe(1);
    const lookup2 = Q(users).ToLookup(
      (u) => u.name,
      (u) => u.email,
    );
    expect(lookup2.get('Josh').toArray()).toHaveLength(2);
    const dict2 = Q(users).ToDictionary(
      (u) => u.id,
      (u) => u.email,
    );
    expect(dict2.get(1)).toBe('josh@example.com');
    expect(Q([1]).Take(5).ToArray()).toEqual([1]);
    expect(Q(users).Max((u) => u.age)).toBe(35);
    expect(Q(users).Min((u) => u.age)).toBe(25);
    expect(Q(users).Average((u) => u.age)).toBe(30);
    expect(Q(users).MinBy((u) => u.age).name).toBe('Amy');
  });

  it('async executor paths', async () => {
    const arr = [1, 2, 3, 4];
    const pipeline = whereFeature.append!(new OpPipeline<number>(), (x) => x % 2 === 0);
    const out: number[] = [];
    for await (const n of executeAsyncPipeline(
      arr as unknown as AsyncIterable<number>,
      pipeline,
    )) {
      out.push(n);
    }
    expect(out).toEqual([2, 4]);

    const ordered: number[] = [];
    for await (const n of executeAsyncPipeline(
      (async function* () {
        yield 3;
        yield 1;
        yield 2;
      })(),
      new OpPipeline([{ kind: 'orderBy', keys: [{ key: (x: number) => x, descending: false }] }]),
    )) {
      ordered.push(n);
    }
    expect(ordered).toEqual([1, 2, 3]);

    const empty: number[] = [];
    for await (const n of executeAsyncPipeline(
      (async function* () {
        yield 1;
      })(),
      new OpPipeline(),
    )) {
      empty.push(n);
    }
    expect(empty).toEqual([1]);

    const controller = new AbortController();
    async function* abortMid() {
      yield 1;
      controller.abort();
      yield 2;
    }
    await expect(
      (async () => {
        for await (const _ of executeAsyncPipeline(
          abortMid(),
          new OpPipeline([{ kind: 'orderBy', keys: [{ key: (x: number) => x, descending: false }] }]),
          controller.signal,
        )) {
          /* materialize via orderBy */
        }
      })(),
    ).rejects.toThrow();

    const done: number[] = [];
    for await (const n of executeAsyncPipeline(
      [1, 2, 3],
      new OpPipeline([{ kind: 'orderBy', keys: [{ key: (x: number) => x, descending: false }] }]),
      new AbortController().signal,
    )) {
      done.push(n);
    }
    expect(done).toEqual([1, 2, 3]);

    const lateAbort = new AbortController();
    async function* twoStep() {
      yield 1;
      await Promise.resolve();
      yield 2;
    }
    const race = (async () => {
      const iter = executeAsyncPipeline(
        twoStep(),
        new OpPipeline([{ kind: 'orderBy', keys: [{ key: (x: number) => x, descending: false }] }]),
        lateAbort.signal,
      );
      await iter.next();
      lateAbort.abort();
      for await (const _ of iter) {
        /* drain */
      }
    })();
    await expect(race).rejects.toThrow();
  });

  it('async OrderBy via QAsync', async () => {
    const names = await QAsync(
      (async function* () {
        for (const u of users) yield u;
      })(),
    )
      .OrderBy((u) => u.age)
      .Select((u) => u.name)
      .ToArrayAsync();
    expect(names[0]).toBe('Amy');
  });

  it('executePipeline empty ops', () => {
    expect([...executePipeline([1], new OpPipeline())]).toEqual([1]);
  });

  it('iterable operators via generator source', () => {
    function* src() {
      yield 1;
      yield 2;
      yield 3;
    }
    expect(Q(src()).Skip(0).ToArray()).toEqual([1, 2, 3]);
    expect(Q(src()).Take(10).ToArray()).toEqual([1, 2, 3]);
    expect(Q(src()).SkipWhile(() => false).ToArray()).toEqual([1, 2, 3]);
    expect(Q(src()).SkipWhile(() => true).ToArray()).toEqual([]);
    expect([...wrapLazy(src(), { kind: 'skip', count: 0 })]).toEqual([1, 2, 3]);
    expect(Q(src()).TakeWhile((x) => x < 3).ToArray()).toEqual([1, 2]);
    expect(Q(src()).SkipWhile((x) => x < 2).ToArray()).toEqual([2, 3]);
    expect([...Q(src()).DefaultIfEmpty(0)]).toEqual([1, 2, 3]);
    expect(
      Q(src())
        .Join(
          [{ k: 2 }],
          () => 99,
          (i) => i.k,
          (_, i) => i.k,
        )
        .ToArray(),
    ).toEqual([]);
  });

  it('terminals with predicates and comparers', () => {
    expect(Q([1, 2, 3]).First((x, i) => i > 0 && x === 2)).toBe(2);
    expect(Q(users).First((u) => u.name === 'Amy').id).toBe(2);
    expect(Q(users).Single((u) => u.id === 1).name).toBe('Josh');
    expect(Q([1, 2]).SequenceEqual([1, 2], (a, b) => a === b)).toBe(true);
    expect(Q(users).FirstOrDefault(users[0]!, (u) => u.id === 999)).toEqual(users[0]!);
    expect(Q([1]).Sum()).toBe(1);
  });

  it('materialize default and Lookup missing key', () => {
    const out = materialize([1], { kind: 'unknown_op' } as PipelineOp<number>);
    expect([...out]).toEqual([1]);
    const lookup = Q(users).ToLookup((u) => u.name);
    expect(lookup.get('missing').toArray()).toEqual([]);
    expect(lookup.contains('Josh')).toBe(true);
  });

  it('throwIfAborted via executeAsyncPipeline without signal', async () => {
    const out: number[] = [];
    for await (const n of executeAsyncPipeline(
      [1, 2] as unknown as AsyncIterable<number>,
      new OpPipeline(),
    )) {
      out.push(n);
    }
    expect(out).toEqual([1, 2]);
  });

  it('compareWith uses defaultComparer', () => {
    expect(compareWith('a', 'b')).toBeLessThan(0);
    expect(compareWith(1n, 2n)).toBeLessThan(0);
  });

  it('async terminal branches', async () => {
    expect(await QAsync((async function* () {})()).AnyAsync()).toBe(false);
    expect(
      await QAsync((async function* () {
        yield 1;
      })()).AnyAsync(),
    ).toBe(true);
    expect(
      await QAsync((async function* () {
        yield 1;
      })()).SequenceEqualAsync(
        (async function* () {
          yield 1;
        })(),
      ),
    ).toBe(true);
    expect(
      await QAsync((async function* () {
        yield 1;
      })()).LastOrDefaultAsync(0),
    ).toBe(1);
    await expect(
      QAsync((async function* () {})()).LastOrDefaultAsync(0, (x: number) => x > 0),
    ).resolves.toBe(0);
    expect(
      await QAsync((async function* () {
        yield 1;
        yield 10;
      })()).AnyAsync((x) => x > 5),
    ).toBe(true);
    const bad = {
      async *[Symbol.asyncIterator]() {
        throw new TypeError('async boom');
      },
    };
    await expect(lastOrDefaultFeature.runAsync!(bad, new OpPipeline(), 0)).rejects.toThrow('async boom');
    await expect(
      QAsync((async function* () {
        yield 1;
        yield 2;
      })()).FirstAsync((x) => x > 1),
    ).resolves.toBe(2);
    await expect(
      QAsync((async function* () {})()).FirstOrDefaultAsync(0, (x: number) => x > 1),
    ).resolves.toBe(0);
    await expect(
      QAsync(bad).FirstOrDefaultAsync(0),
    ).rejects.toThrow('async boom');
  });

  it('Query async iteration', async () => {
    const q = Q([1, 2]).Select((x) => x * 2);
    expect([...q]).toEqual([2, 4]);
    const aq = QAsync(
      (async function* () {
        yield 1;
      })(),
    );
    const collected: number[] = [];
    for await (const x of aq) collected.push(x);
    expect(collected).toEqual([1]);
  });

  it('FirstOrDefault and LastOrDefault propagate foreign errors', async () => {
    const bad = {
      [Symbol.iterator]() {
        throw new TypeError('boom');
      },
      [Symbol.asyncIterator]() {
        return {
          async next() {
            throw new TypeError('boom');
          }
        };
      }
    };
    expect(() => firstOrDefaultFeature.runSync!(bad, new OpPipeline(), 0)).toThrow('boom');
    expect(() => lastOrDefaultFeature.runSync!(bad, new OpPipeline(), 0)).toThrow('boom');
    await expect(firstOrDefaultFeature.runAsync!(bad as any, new OpPipeline(), 0)).rejects.toThrow('boom');
    await expect(lastOrDefaultFeature.runAsync!(bad as any, new OpPipeline(), 0)).rejects.toThrow('boom');
  });

  it('ForEachAsync concurrency and abort signals', async () => {
    // Test concurrency > 1
    const items: number[] = [];
    await QAsync([1, 2, 3]).ForEachAsync(async (x) => {
      items.push(x);
    }, { concurrency: 2 });
    expect(items.sort()).toEqual([1, 2, 3]);

    // Test concurrency = 1 abort signal
    const controller = new AbortController();
    controller.abort();
    await expect(
      QAsync([1, 2]).ForEachAsync(() => {}, { signal: controller.signal })
    ).rejects.toThrow('Aborted');

    // Test concurrency > 1 abort signal
    await expect(
      QAsync([1, 2]).ForEachAsync(() => {}, { concurrency: 2, signal: controller.signal })
    ).rejects.toThrow('Aborted');
  });

  it('lazy operators generator fallback executeSync coverage', () => {
    function* gen() {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
    }
    const res = Q(gen())
      .Where((x) => x > 1)
      .Select((x) => x * 2)
      .Skip(1)
      .Take(1)
      .ToArray();
    expect(res).toEqual([6]);
  });
});
