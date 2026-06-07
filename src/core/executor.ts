import { isArray } from '../utils/isArray.js';
import type { OpPipeline } from './OpPipeline.js';
import { canUseArrayFastPath, type PipelineOp, isLazyFusableOp, isMaterializingOp, type OrderKeyEntry } from './pipelineOps.js';
import type { Predicate, Selector, EqualityComparer } from './types.js';
import { Grouping, EmptySequenceError } from './types.js';
import { FeatureRegistry } from './FeaturePlugin.js';
import { stableSortInPlace, compareOrderKeys } from '../features/materializing/orderByHelpers.js';
import { buildJoinLookup, findJoinMatches } from '../utils/joinLookup.js';
import { TakeLastBuffer, SkipLastBuffer } from '../utils/slidingWindow.js';
import { forEachFusible, parseFusibleSteps } from '../utils/fusibleSteps.js';
import { kahanAdd, kahanTotal } from '../utils/kahanSum.js';

interface PullStep {
  next(): IteratorResult<any>;
}

// -----------------------------------------------------------------------------
// Array Fast Path Iterator Classes (Synchronous)
// -----------------------------------------------------------------------------

class ArrayWhereIterator<T> implements Iterator<T> {
  private i = 0;
  constructor(private arr: T[], private p: Predicate<T>) {}
  next(): IteratorResult<T> {
    while (this.i < this.arr.length) {
      const item = this.arr[this.i]!;
      if (this.p(item, this.i++)) {
        return { done: false, value: item };
      }
    }
    return { done: true, value: undefined };
  }
}

class ArraySelectIterator<T, R> implements Iterator<R> {
  private i = 0;
  constructor(private arr: T[], private s: Selector<T, R>) {}
  next(): IteratorResult<R> {
    if (this.i < this.arr.length) {
      const val = this.s(this.arr[this.i]!, this.i);
      this.i++;
      return { done: false, value: val };
    }
    return { done: true, value: undefined };
  }
}

class ArrayTakeIterator<T> implements Iterator<T> {
  private i = 0;
  constructor(private arr: T[], private count: number) {}
  next(): IteratorResult<T> {
    if (this.i < this.count && this.i < this.arr.length) {
      return { done: false, value: this.arr[this.i++]! };
    }
    return { done: true, value: undefined };
  }
}

class ArraySkipIterator<T> implements Iterator<T> {
  private i: number;
  constructor(private arr: T[], count: number) {
    this.i = Math.max(0, count);
  }
  next(): IteratorResult<T> {
    if (this.i < this.arr.length) {
      return { done: false, value: this.arr[this.i++]! };
    }
    return { done: true, value: undefined };
  }
}

class ArrayWhereSelectIterator<T, R> implements Iterator<R> {
  private i = 0;
  constructor(private arr: T[], private p: Predicate<T>, private s: Selector<T, R>) {}
  next(): IteratorResult<R> {
    while (this.i < this.arr.length) {
      const item = this.arr[this.i]!;
      if (this.p(item, this.i)) {
        const val = this.s(item, this.i++);
        return { done: false, value: val };
      }
      this.i++;
    }
    return { done: true, value: undefined };
  }
}

class ArrayWhereTakeIterator<T> implements Iterator<T> {
  private i = 0;
  private taken = 0;
  constructor(private arr: T[], private p: Predicate<T>, private count: number) {}
  next(): IteratorResult<T> {
    if (this.taken >= this.count) return { done: true, value: undefined };
    while (this.i < this.arr.length) {
      const item = this.arr[this.i]!;
      if (this.p(item, this.i++)) {
        this.taken++;
        return { done: false, value: item };
      }
    }
    return { done: true, value: undefined };
  }
}

class ArraySelectTakeIterator<T, R> implements Iterator<R> {
  private i = 0;
  constructor(private arr: T[], private s: Selector<T, R>, private count: number) {}
  next(): IteratorResult<R> {
    if (this.i < this.count && this.i < this.arr.length) {
      const val = this.s(this.arr[this.i]!, this.i);
      this.i++;
      return { done: false, value: val };
    }
    return { done: true, value: undefined };
  }
}

class ArrayWhereSelectTakeIterator<T, R> implements Iterator<R> {
  private i = 0;
  private taken = 0;
  constructor(
    private arr: T[],
    private p: Predicate<T>,
    private s: Selector<T, R>,
    private count: number
  ) {}
  next(): IteratorResult<R> {
    if (this.taken >= this.count) return { done: true, value: undefined };
    while (this.i < this.arr.length) {
      const item = this.arr[this.i]!;
      if (this.p(item, this.i)) {
        const val = this.s(item, this.i++);
        this.taken++;
        return { done: false, value: val };
      }
      this.i++;
    }
    return { done: true, value: undefined };
  }
}

class ArrayWhereSkipTakeIterator<T> implements Iterator<T> {
  private i = 0;
  private skipped = 0;
  private taken = 0;
  constructor(
    private arr: T[],
    private p: Predicate<T>,
    private skip: number,
    private take: number
  ) {}
  next(): IteratorResult<T> {
    if (this.taken >= this.take) return { done: true, value: undefined };
    while (this.i < this.arr.length) {
      const item = this.arr[this.i]!;
      if (this.p(item, this.i++)) {
        if (this.skipped < this.skip) {
          this.skipped++;
        } else {
          this.taken++;
          return { done: false, value: item };
        }
      }
    }
    return { done: true, value: undefined };
  }
}

// -----------------------------------------------------------------------------
// Lazy Pull Steps
// -----------------------------------------------------------------------------

class WherePullStep implements PullStep {
  private index = 0;
  constructor(private source: PullStep, private predicate: Predicate<any>) {}
  next() {
    while (true) {
      const res = this.source.next();
      if (res.done) return res;
      if (this.predicate(res.value, this.index++)) {
        return res;
      }
    }
  }
}

class SelectPullStep implements PullStep {
  private index = 0;
  constructor(private source: PullStep, private selector: Selector<any, any>) {}
  next() {
    const res = this.source.next();
    if (res.done) return res;
    return { done: false, value: this.selector(res.value, this.index++) };
  }
}

class TakePullStep implements PullStep {
  private taken = 0;
  constructor(private source: PullStep, private count: number) {}
  next() {
    if (this.taken >= this.count) {
      return { done: true, value: undefined };
    }
    const res = this.source.next();
    if (res.done) return res;
    this.taken++;
    return res;
  }
}

class SkipPullStep implements PullStep {
  private skipped = 0;
  constructor(private source: PullStep, private count: number) {}
  next() {
    while (this.skipped < this.count) {
      const res = this.source.next();
      if (res.done) return res;
      this.skipped++;
    }
    return this.source.next();
  }
}

class TakeWhilePullStep implements PullStep {
  private index = 0;
  private done = false;
  constructor(private source: PullStep, private predicate: Predicate<any>) {}
  next() {
    if (this.done) return { done: true, value: undefined };
    const res = this.source.next();
    if (res.done) return res;
    if (this.predicate(res.value, this.index++)) {
      return res;
    }
    this.done = true;
    return { done: true, value: undefined };
  }
}

class SkipWhilePullStep implements PullStep {
  private index = 0;
  private skipping = true;
  constructor(private source: PullStep, private predicate: Predicate<any>) {}
  next() {
    while (this.skipping) {
      const res = this.source.next();
      if (res.done) return res;
      if (!this.predicate(res.value, this.index++)) {
        this.skipping = false;
        return res;
      }
    }
    return this.source.next();
  }
}

class ChunkPullStep implements PullStep {
  constructor(private source: PullStep, private size: number) {}
  next() {
    const bucket: any[] = [];
    while (bucket.length < this.size) {
      const res = this.source.next();
      if (res.done) {
        if (bucket.length > 0) {
          return { done: false, value: bucket };
        }
        return res;
      }
      bucket.push(res.value);
    }
    return { done: false, value: bucket };
  }
}

class SelectManyPullStep implements PullStep {
  private index = 0;
  private currentIterator: Iterator<any> | null = null;
  constructor(private source: PullStep, private selector: Selector<any, Iterable<any>>) {}
  next() {
    while (true) {
      if (!this.currentIterator) {
        const res = this.source.next();
        if (res.done) return res;
        const iterable = this.selector(res.value, this.index++);
        this.currentIterator = iterable[Symbol.iterator]();
      }
      const subRes = this.currentIterator.next();
      if (!subRes.done) {
        return { done: false, value: subRes.value };
      }
      this.currentIterator = null;
    }
  }
}

class OfTypePullStep implements PullStep {
  constructor(
    private source: PullStep,
    private guard: (item: unknown) => boolean,
  ) {}
  next() {
    while (true) {
      const res = this.source.next();
      if (res.done) return res;
      if (this.guard(res.value)) {
        return res;
      }
    }
  }
}

class CastPullStep implements PullStep {
  constructor(private source: PullStep) {}
  next() {
    return this.source.next();
  }
}

class DistinctPullStep implements PullStep {
  private seenSet = new Set<any>();
  private seenArr: any[] = [];
  constructor(private source: PullStep, private comparer?: EqualityComparer<any>) {}
  next() {
    while (true) {
      const res = this.source.next();
      if (res.done) return res;
      if (!this.comparer) {
        if (!this.seenSet.has(res.value)) {
          this.seenSet.add(res.value);
          return res;
        }
      } else {
        const eq = this.comparer;
        if (!this.seenArr.some((x) => eq(x, res.value))) {
          this.seenArr.push(res.value);
          return res;
        }
      }
    }
  }
}

class DistinctByPullStep implements PullStep {
  private seenSet = new Set<any>();
  private seenArr: any[] = [];
  private index = 0;
  constructor(
    private source: PullStep,
    private keySelector: Selector<any, any>,
    private comparer?: EqualityComparer<any>
  ) {}
  next() {
    while (true) {
      const res = this.source.next();
      if (res.done) return res;
      const key = this.keySelector(res.value, this.index++);
      if (!this.comparer) {
        if (!this.seenSet.has(key)) {
          this.seenSet.add(key);
          return res;
        }
      } else {
        const eq = this.comparer;
        if (!this.seenArr.some((x) => eq(x, key))) {
          this.seenArr.push(key);
          return res;
        }
      }
    }
  }
}

class DefaultIfEmptyPullStep implements PullStep {
  private hasAny = false;
  private done = false;
  constructor(private source: PullStep, private defaultValue: any) {}
  next() {
    if (this.done) return { done: true, value: undefined };
    const res = this.source.next();
    if (!res.done) {
      this.hasAny = true;
      return res;
    }
    this.done = true;
    if (!this.hasAny) {
      return { done: false, value: this.defaultValue };
    }
    return res;
  }
}

class ScanPullStep implements PullStep {
  private acc: any;
  private index = 0;
  private yieldedSeed = false;
  constructor(private source: PullStep, private seed: any, private func: Function) {
    this.acc = seed;
  }
  next() {
    if (!this.yieldedSeed) {
      this.yieldedSeed = true;
      return { done: false, value: this.acc };
    }
    const res = this.source.next();
    if (res.done) return res;
    this.acc = this.func(this.acc, res.value, this.index++);
    return { done: false, value: this.acc };
  }
}

class WithIndexPullStep implements PullStep {
  private index = 0;
  constructor(private source: PullStep) {}
  next() {
    const res = this.source.next();
    if (res.done) return res;
    return { done: false, value: { value: res.value, index: this.index++ } };
  }
}

class IndexPullStep implements PullStep {
  private index = 0;
  constructor(private source: PullStep) {}
  next() {
    const res = this.source.next();
    if (res.done) return res;
    return { done: false, value: [this.index++, res.value] };
  }
}

class BufferPullStep implements PullStep {
  private window: any[] = [];
  constructor(private source: PullStep, private size: number, private step: number) {}
  next() {
    while (true) {
      const res = this.source.next();
      if (res.done) return res;
      this.window.push(res.value);
      if (this.window.length >= this.size) {
        const buf = this.window.slice(0, this.size);
        this.window.splice(0, Math.min(this.step, this.window.length));
        return { done: false, value: buf };
      }
    }
  }
}

class TryWherePullStep implements PullStep {
  private index = 0;
  constructor(private source: PullStep, private predicate: Predicate<any>) {}
  next() {
    while (true) {
      const res = this.source.next();
      if (res.done) return res;
      try {
        if (this.predicate(res.value, this.index++)) {
          return res;
        }
      } catch {
        // ignore
      }
    }
  }
}

class PairwisePullStep implements PullStep {
  private hasPrev = false;
  private prev: any = null;
  constructor(private source: PullStep) {}
  next() {
    if (!this.hasPrev) {
      const first = this.source.next();
      if (first.done) return first;
      this.prev = first.value;
      this.hasPrev = true;
    }
    const current = this.source.next();
    if (current.done) return current;
    const p = this.prev;
    this.prev = current.value;
    return { done: false, value: [p, current.value] };
  }
}

class TapPullStep implements PullStep {
  private index = 0;
  constructor(private source: PullStep, private action: Function) {}
  next() {
    const res = this.source.next();
    if (res.done) return res;
    this.action(res.value, this.index++);
    return res;
  }
}

class FlattenPullStep implements PullStep {
  private currentIterator: Iterator<any> | null = null;
  constructor(private source: PullStep) {}
  next() {
    while (true) {
      if (!this.currentIterator) {
        const res = this.source.next();
        if (res.done) return res;
        this.currentIterator = res.value[Symbol.iterator]();
      }
      const subRes = this.currentIterator!.next();
      if (!subRes.done) {
        return { done: false, value: subRes.value };
      }
      this.currentIterator = null;
    }
  }
}

class AdjacentDistinctPullStep implements PullStep {
  private hasLast = false;
  private last: any = null;
  constructor(private source: PullStep, private comparer?: EqualityComparer<any>) {}
  next() {
    const eq = this.comparer ?? (Object.is as EqualityComparer<any>);
    while (true) {
      const res = this.source.next();
      if (res.done) return res;
      if (!this.hasLast) {
        this.last = res.value;
        this.hasLast = true;
        return res;
      }
      if (!eq(this.last, res.value)) {
        this.last = res.value;
        return res;
      }
    }
  }
}

class PrependPullStep implements PullStep {
  private prependIterator: Iterator<any> | null = null;
  constructor(private source: PullStep, private items: Iterable<any>) {}
  next() {
    if (!this.prependIterator) {
      this.prependIterator = this.items[Symbol.iterator]();
    }
    const res = this.prependIterator.next();
    if (!res.done) return res;
    return this.source.next();
  }
}

class AppendPullStep implements PullStep {
  private appendIterator: Iterator<any> | null = null;
  constructor(private source: PullStep, private items: Iterable<any>) {}
  next() {
    const res = this.source.next();
    if (!res.done) return res;
    if (!this.appendIterator) {
      this.appendIterator = this.items[Symbol.iterator]();
    }
    return this.appendIterator.next();
  }
}

class TakeLastPullStep implements PullStep {
  private buffer: TakeLastBuffer<unknown> | null = null;
  private iterator: Iterator<unknown> | null = null;
  constructor(private source: PullStep, private count: number) {}
  next() {
    if (!this.buffer) {
      this.buffer = new TakeLastBuffer(this.count);
      if (this.count > 0) {
        while (true) {
          const res = this.source.next();
          if (res.done) break;
          this.buffer.push(res.value);
        }
      }
      this.iterator = this.buffer[Symbol.iterator]();
    }
    return this.iterator!.next();
  }
}

class SkipLastPullStep implements PullStep {
  private buffer: SkipLastBuffer<unknown> | null = null;
  constructor(private source: PullStep, private count: number) {}
  next() {
    if (this.count <= 0) {
      return this.source.next();
    }
    if (!this.buffer) {
      this.buffer = new SkipLastBuffer(this.count);
    }
    while (true) {
      const res = this.source.next();
      if (res.done) return res;
      const out = this.buffer.push(res.value);
      if (out !== undefined) {
        return { done: false, value: out };
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Materializing Pull Steps
// -----------------------------------------------------------------------------

class OrderByPullStep implements PullStep {
  private sorted: any[] | null = null;
  private index = 0;
  constructor(private source: PullStep, private keys: OrderKeyEntry<any>[]) {}
  next() {
    if (!this.sorted) {
      this.sorted = [];
      while (true) {
        const res = this.source.next();
        if (res.done) break;
        this.sorted.push(res.value);
      }
      stableSortInPlace(this.sorted, this.keys);
    }
    if (this.index < this.sorted.length) {
      return { done: false, value: this.sorted[this.index++] };
    }
    return { done: true, value: undefined };
  }
}

class GroupByPullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(
    private source: PullStep,
    private keySelector: Selector<any, any>,
    private elementSelector?: Selector<any, any>
  ) {}
  next() {
    if (!this.iterator) {
      const map = new Map<any, any[]>();
      let index = 0;
      while (true) {
        const res = this.source.next();
        if (res.done) break;
        const key = this.keySelector(res.value, index);
        const element = this.elementSelector ? this.elementSelector(res.value, index) : res.value;
        const bucket = map.get(key);
        if (bucket) bucket.push(element);
        else map.set(key, [element]);
        index++;
      }
      const groupings: Grouping<any, any>[] = [];
      for (const [key, elements] of map) {
        groupings.push(new Grouping(key, elements));
      }
      this.iterator = groupings[Symbol.iterator]();
    }
    return this.iterator.next();
  }
}

class JoinPullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(
    private source: PullStep,
    private inner: Iterable<any>,
    private outerKeySelector: Selector<any, any>,
    private innerKeySelector: Selector<any, any>,
    private resultSelector: (outer: any, inner: any) => any,
    private comparer?: EqualityComparer<any>
  ) {}
  next() {
    if (!this.iterator) {
      const { lookup, eq, isDefault } = buildJoinLookup(this.inner, this.innerKeySelector, this.comparer);
      const results: any[] = [];
      let outerIndex = 0;
      while (true) {
        const res = this.source.next();
        if (res.done) break;
        const outerItem = res.value;
        const key = this.outerKeySelector(outerItem, outerIndex++);
        let matches: any[];
        if (isDefault) {
          matches = lookup.get(key) ?? [];
        } else {
          matches = findJoinMatches(lookup, key, eq, false);
        }
        for (let i = 0; i < matches.length; i++) {
          results.push(this.resultSelector(outerItem, matches[i]));
        }
      }
      this.iterator = results[Symbol.iterator]();
    }
    return this.iterator.next();
  }
}

class LeftJoinPullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(
    private source: PullStep,
    private inner: Iterable<any>,
    private outerKeySelector: Selector<any, any>,
    private innerKeySelector: Selector<any, any>,
    private resultSelector: (outer: any, inner: any | null) => any,
    private comparer?: EqualityComparer<any>
  ) {}
  next() {
    if (!this.iterator) {
      const { lookup, eq, isDefault } = buildJoinLookup(this.inner, this.innerKeySelector, this.comparer);
      const results: any[] = [];
      let outerIndex = 0;
      while (true) {
        const res = this.source.next();
        if (res.done) break;
        const outerItem = res.value;
        const key = this.outerKeySelector(outerItem, outerIndex++);
        let matches: any[];
        if (isDefault) {
          matches = lookup.get(key) ?? [];
        } else {
          matches = findJoinMatches(lookup, key, eq, false);
        }
        if (matches.length === 0) {
          results.push(this.resultSelector(outerItem, null));
        } else {
          for (let i = 0; i < matches.length; i++) {
            results.push(this.resultSelector(outerItem, matches[i]));
          }
        }
      }
      this.iterator = results[Symbol.iterator]();
    }
    return this.iterator.next();
  }
}

class RightJoinPullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(
    private source: PullStep,
    private inner: Iterable<any>,
    private outerKeySelector: Selector<any, any>,
    private innerKeySelector: Selector<any, any>,
    private resultSelector: (outer: any | null, inner: any) => any,
    private comparer?: EqualityComparer<any>
  ) {}
  next() {
    if (!this.iterator) {
      const outerItems: any[] = [];
      let outerIndex = 0;
      while (true) {
        const res = this.source.next();
        if (res.done) break;
        outerItems.push(res.value);
      }
      const { lookup, eq, isDefault } = buildJoinLookup(outerItems, this.outerKeySelector, this.comparer);
      const results: any[] = [];
      let innerIndex = 0;
      for (const innerItem of this.inner) {
        const key = this.innerKeySelector(innerItem, innerIndex++);
        let matches: any[];
        if (isDefault) {
          matches = lookup.get(key) ?? [];
        } else {
          matches = findJoinMatches(lookup, key, eq, false);
        }
        if (matches.length === 0) {
          results.push(this.resultSelector(null, innerItem));
        } else {
          for (const outerItem of matches) {
            results.push(this.resultSelector(outerItem, innerItem));
          }
        }
      }
      this.iterator = results[Symbol.iterator]();
    }
    return this.iterator.next();
  }
}

class FullJoinPullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(
    private source: PullStep,
    private inner: Iterable<any>,
    private outerKeySelector: Selector<any, any>,
    private innerKeySelector: Selector<any, any>,
    private resultSelector: (outer: any | null, inner: any | null) => any,
    private comparer?: EqualityComparer<any>
  ) {}
  next() {
    if (!this.iterator) {
      const innerList = [...this.inner];
      const { lookup, eq, isDefault } = buildJoinLookup(innerList, this.innerKeySelector, this.comparer);
      const matchedInner = new Set<any>();
      const results: any[] = [];
      
      let outerIndex = 0;
      while (true) {
        const res = this.source.next();
        if (res.done) break;
        const outerItem = res.value;
        const key = this.outerKeySelector(outerItem, outerIndex++);
        let matches: any[];
        if (isDefault) {
          matches = lookup.get(key) ?? [];
        } else {
          matches = findJoinMatches(lookup, key, eq, false);
        }
        if (matches.length === 0) {
          results.push(this.resultSelector(outerItem, null));
        } else {
          for (let i = 0; i < matches.length; i++) {
            const innerItem = matches[i];
            matchedInner.add(innerItem);
            results.push(this.resultSelector(outerItem, innerItem));
          }
        }
      }
      for (const innerItem of innerList) {
        if (!matchedInner.has(innerItem)) {
          results.push(this.resultSelector(null, innerItem));
        }
      }
      this.iterator = results[Symbol.iterator]();
    }
    return this.iterator.next();
  }
}

class GroupJoinPullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(
    private source: PullStep,
    private inner: Iterable<any>,
    private outerKeySelector: Selector<any, any>,
    private innerKeySelector: Selector<any, any>,
    private resultSelector: (outer: any, inner: Iterable<any>) => any,
    private comparer?: EqualityComparer<any>
  ) {}
  next() {
    if (!this.iterator) {
      const isDefault = this.comparer === undefined;
      const eq = this.comparer ?? (Object.is as EqualityComparer<any>);
      const innerLookup = new Map<unknown, any[]>();
      let innerIndex = 0;
      for (const item of this.inner) {
        const key = this.innerKeySelector(item, innerIndex++);
        const list = innerLookup.get(key);
        if (list) list.push(item);
        else innerLookup.set(key, [item]);
      }
      
      const results: any[] = [];
      let outerIndex = 0;
      while (true) {
        const res = this.source.next();
        if (res.done) break;
        const outerItem = res.value;
        const key = this.outerKeySelector(outerItem, outerIndex++);
        let matches: any[];
        if (isDefault) {
          matches = innerLookup.get(key) ?? [];
        } else {
          matches = [];
          for (const [storedKey, inners] of innerLookup) {
            if (eq(storedKey, key)) matches.push(...inners);
          }
        }
        results.push(this.resultSelector(outerItem, matches));
      }
      this.iterator = results[Symbol.iterator]();
    }
    return this.iterator.next();
  }
}

class UnionPullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(
    private source: PullStep,
    private second: Iterable<any>,
    private comparer?: EqualityComparer<any>
  ) {}
  next() {
    if (!this.iterator) {
      const results: any[] = [];
      if (!this.comparer) {
        const seen = new Set<any>();
        while (true) {
          const res = this.source.next();
          if (res.done) break;
          if (!seen.has(res.value)) {
            seen.add(res.value);
            results.push(res.value);
          }
        }
        for (const item of this.second) {
          if (!seen.has(item)) {
            seen.add(item);
            results.push(item);
          }
        }
      } else {
        const eq = this.comparer;
        while (true) {
          const res = this.source.next();
          if (res.done) break;
          if (!results.some((x) => eq(x, res.value))) {
            results.push(res.value);
          }
        }
        for (const item of this.second) {
          if (!results.some((x) => eq(x, item))) {
            results.push(item);
          }
        }
      }
      this.iterator = results[Symbol.iterator]();
    }
    return this.iterator.next();
  }
}

class IntersectPullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(
    private source: PullStep,
    private second: Iterable<any>,
    private comparer?: EqualityComparer<any>
  ) {}
  next() {
    if (!this.iterator) {
      const results: any[] = [];
      if (!this.comparer) {
        const secondSet = new Set(this.second);
        const yielded = new Set<any>();
        while (true) {
          const res = this.source.next();
          if (res.done) break;
          if (secondSet.has(res.value) && !yielded.has(res.value)) {
            yielded.add(res.value);
            results.push(res.value);
          }
        }
      } else {
        const eq = this.comparer;
        const secondList = [...this.second];
        while (true) {
          const res = this.source.next();
          if (res.done) break;
          if (secondList.some((s) => eq(s, res.value)) && !results.some((r) => eq(r, res.value))) {
            results.push(res.value);
          }
        }
      }
      this.iterator = results[Symbol.iterator]();
    }
    return this.iterator.next();
  }
}

class ExceptPullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(
    private source: PullStep,
    private second: Iterable<any>,
    private comparer?: EqualityComparer<any>
  ) {}
  next() {
    if (!this.iterator) {
      const results: any[] = [];
      if (!this.comparer) {
        const secondSet = new Set(this.second);
        while (true) {
          const res = this.source.next();
          if (res.done) break;
          if (!secondSet.has(res.value)) {
            results.push(res.value);
          }
        }
      } else {
        const eq = this.comparer;
        const secondList = [...this.second];
        while (true) {
          const res = this.source.next();
          if (res.done) break;
          if (!secondList.some((s) => eq(s, res.value))) {
            results.push(res.value);
          }
        }
      }
      this.iterator = results[Symbol.iterator]();
    }
    return this.iterator.next();
  }
}

class UnionByPullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(
    private source: PullStep,
    private second: Iterable<any>,
    private keySelector: Selector<any, any>,
    private comparer?: EqualityComparer<any>
  ) {}
  next() {
    if (!this.iterator) {
      const results: any[] = [];
      const seenKeysSet = new Set<any>();
      const seenKeysArr: any[] = [];
      
      let index = 0;
      while (true) {
        const res = this.source.next();
        if (res.done) break;
        const key = this.keySelector(res.value, index++);
        if (!this.comparer) {
          if (!seenKeysSet.has(key)) {
            seenKeysSet.add(key);
            results.push(res.value);
          }
        } else {
          const eq = this.comparer;
          if (!seenKeysArr.some((x) => eq(x, key))) {
            seenKeysArr.push(key);
            results.push(res.value);
          }
        }
      }
      
      let secondIndex = 0;
      for (const item of this.second) {
        const key = this.keySelector(item, secondIndex++);
        if (!this.comparer) {
          if (!seenKeysSet.has(key)) {
            seenKeysSet.add(key);
            results.push(item);
          }
        } else {
          const eq = this.comparer;
          if (!seenKeysArr.some((x) => eq(x, key))) {
            seenKeysArr.push(key);
            results.push(item);
          }
        }
      }
      this.iterator = results[Symbol.iterator]();
    }
    return this.iterator.next();
  }
}

class IntersectByPullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(
    private source: PullStep,
    private second: Iterable<any>,
    private keySelector: Selector<any, any>,
    private comparer?: EqualityComparer<any>
  ) {}
  next() {
    if (!this.iterator) {
      const results: any[] = [];
      const secondKeysSet = !this.comparer ? new Set(this.second) : null;
      const secondKeysArr = this.comparer ? [...this.second] : null;
      const yieldedKeysSet = new Set<any>();
      const yieldedKeysArr: any[] = [];
      
      let index = 0;
      while (true) {
        const res = this.source.next();
        if (res.done) break;
        const key = this.keySelector(res.value, index++);
        if (!this.comparer) {
          if (secondKeysSet!.has(key) && !yieldedKeysSet.has(key)) {
            yieldedKeysSet.add(key);
            results.push(res.value);
          }
        } else {
          const eq = this.comparer;
          if (secondKeysArr!.some((s) => eq(s, key)) && !yieldedKeysArr.some((y) => eq(y, key))) {
            yieldedKeysArr.push(key);
            results.push(res.value);
          }
        }
      }
      this.iterator = results[Symbol.iterator]();
    }
    return this.iterator.next();
  }
}

class ExceptByPullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(
    private source: PullStep,
    private second: Iterable<any>,
    private keySelector: Selector<any, any>,
    private comparer?: EqualityComparer<any>
  ) {}
  next() {
    if (!this.iterator) {
      const results: any[] = [];
      const secondKeysSet = !this.comparer ? new Set(this.second) : null;
      const secondKeysArr = this.comparer ? [...this.second] : null;
      const yieldedKeysSet = new Set<any>();
      const yieldedKeysArr: any[] = [];
      
      let index = 0;
      while (true) {
        const res = this.source.next();
        if (res.done) break;
        const key = this.keySelector(res.value, index++);
        if (!this.comparer) {
          if (!secondKeysSet!.has(key) && !yieldedKeysSet.has(key)) {
            yieldedKeysSet.add(key);
            results.push(res.value);
          }
        } else {
          const eq = this.comparer;
          if (!secondKeysArr!.some((s) => eq(s, key)) && !yieldedKeysArr.some((y) => eq(y, key))) {
            yieldedKeysArr.push(key);
            results.push(res.value);
          }
        }
      }
      this.iterator = results[Symbol.iterator]();
    }
    return this.iterator.next();
  }
}

class AggregateByPullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(
    private source: PullStep,
    private keySelector: Selector<any, any>,
    private seed: any,
    private func: (acc: any, item: any) => any,
    private comparer?: EqualityComparer<any>
  ) {}
  next() {
    if (!this.iterator) {
      const eq = this.comparer ?? (Object.is as EqualityComparer<any>);
      const groups: { key: any; acc: any }[] = [];
      const useMap = !this.comparer;
      const map = new Map<any, any>();
      
      let index = 0;
      while (true) {
        const res = this.source.next();
        if (res.done) break;
        const item = res.value;
        const key = this.keySelector(item, index++);
        if (useMap) {
          if (!map.has(key)) {
            const s = typeof this.seed === 'function' ? this.seed(item) : this.seed;
            map.set(key, s);
          }
          const currentAcc = map.get(key);
          map.set(key, this.func(currentAcc, item));
        } else {
          let entry = groups.find((g) => eq(g.key, key));
          if (!entry) {
            const s = typeof this.seed === 'function' ? this.seed(item) : this.seed;
            entry = { key, acc: s };
            groups.push(entry);
          }
          entry.acc = this.func(entry.acc, item);
        }
      }
      
      const results: [any, any][] = [];
      if (useMap) {
        for (const [key, acc] of map.entries()) {
          results.push([key, acc]);
        }
      } else {
        for (const g of groups) {
          results.push([g.key, g.acc]);
        }
      }
      this.iterator = results[Symbol.iterator]();
    }
    return this.iterator.next();
  }
}

class ZipPullStep implements PullStep {
  private secondIterator: Iterator<any> | null = null;
  constructor(
    private source: PullStep,
    private second: Iterable<any>,
    private resultSelector: (first: any, second: any) => any
  ) {}
  next() {
    if (!this.secondIterator) {
      this.secondIterator = this.second[Symbol.iterator]();
    }
    const res1 = this.source.next();
    const res2 = this.secondIterator.next();
    if (res1.done || res2.done) {
      return { done: true, value: undefined };
    }
    return { done: false, value: this.resultSelector(res1.value, res2.value) };
  }
}

class ConcatPullStep implements PullStep {
  private secondIterator: Iterator<any> | null = null;
  constructor(private source: PullStep, private second: Iterable<any>) {}
  next() {
    const res = this.source.next();
    if (!res.done) return res;
    if (!this.secondIterator) {
      this.secondIterator = this.second[Symbol.iterator]();
    }
    return this.secondIterator.next();
  }
}

class ReversePullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(private source: PullStep) {}
  next() {
    if (!this.iterator) {
      const items: any[] = [];
      while (true) {
        const res = this.source.next();
        if (res.done) break;
        items.push(res.value);
      }
      items.reverse();
      this.iterator = items[Symbol.iterator]();
    }
    return this.iterator.next();
  }
}

class MaterializingPullStep implements PullStep {
  private iterator: Iterator<any> | null = null;
  constructor(private source: PullStep, private op: PipelineOp<any>) {}
  next() {
    if (!this.iterator) {
      const iterableSource = {
        [Symbol.iterator]: () => ({
          next: () => this.source.next()
        })
      };
      const feature = FeatureRegistry.get(this.op.kind);
      if (feature && feature.executeSync) {
        const resIterable = feature.executeSync(iterableSource, this.op);
        this.iterator = resIterable[Symbol.iterator]();
      } else {
        this.iterator = iterableSource[Symbol.iterator]();
      }
    }
    return this.iterator.next();
  }
}

// -----------------------------------------------------------------------------
// Step Factory
// -----------------------------------------------------------------------------

function createPullStep(source: PullStep, op: PipelineOp<any>): PullStep {
  switch (op.kind) {
    case 'where':
      return new WherePullStep(source, op.predicate);
    case 'select':
      return new SelectPullStep(source, op.selector);
    case 'take':
      return new TakePullStep(source, op.count);
    case 'skip':
      return new SkipPullStep(source, op.count);
    case 'takeWhile':
      return new TakeWhilePullStep(source, op.predicate);
    case 'skipWhile':
      return new SkipWhilePullStep(source, op.predicate);
    case 'chunk':
      return new ChunkPullStep(source, op.size);
    case 'selectMany':
      return new SelectManyPullStep(source, op.selector);
    case 'ofType':
      return new OfTypePullStep(
        source,
        op.guard ??
          ((item: unknown) => item !== null && item !== undefined && typeof item === 'object'),
      );
    case 'cast':
      return new CastPullStep(source);
    case 'distinct':
      return new DistinctPullStep(source, op.comparer);
    case 'distinctBy':
      return new DistinctByPullStep(source, op.keySelector, op.comparer);
    case 'defaultIfEmpty':
      return new DefaultIfEmptyPullStep(source, op.defaultValue);
    case 'scan':
      return new ScanPullStep(source, op.seed, op.func);
    case 'withIndex':
      return new WithIndexPullStep(source);
    case 'index':
      return new IndexPullStep(source);
    case 'buffer':
      return new BufferPullStep(source, op.size, op.step);
    case 'tryWhere':
      return new TryWherePullStep(source, op.predicate);
    case 'pairwise':
      return new PairwisePullStep(source);
    case 'tap':
      return new TapPullStep(source, op.action);
    case 'flatten':
      return new FlattenPullStep(source);
    case 'adjacentDistinct':
      return new AdjacentDistinctPullStep(source, op.comparer);
    case 'prepend':
      return new PrependPullStep(source, op.items);
    case 'append':
      return new AppendPullStep(source, op.items);
    case 'takeLast':
      return new TakeLastPullStep(source, op.count);
    case 'skipLast':
      return new SkipLastPullStep(source, op.count);
    case 'orderBy':
      return new OrderByPullStep(source, op.keys);
    case 'groupBy':
      return new GroupByPullStep(source, op.keySelector, op.elementSelector);
    case 'join':
      return new JoinPullStep(source, op.inner, op.outerKeySelector, op.innerKeySelector, op.resultSelector, op.comparer);
    case 'leftJoin':
      return new LeftJoinPullStep(source, op.inner, op.outerKeySelector, op.innerKeySelector, op.resultSelector, op.comparer);
    case 'rightJoin':
      return new RightJoinPullStep(source, op.inner, op.outerKeySelector, op.innerKeySelector, op.resultSelector, op.comparer);
    case 'fullJoin':
      return new FullJoinPullStep(source, op.inner, op.outerKeySelector, op.innerKeySelector, op.resultSelector, op.comparer);
    case 'groupJoin':
      return new GroupJoinPullStep(source, op.inner, op.outerKeySelector, op.innerKeySelector, op.resultSelector, op.comparer);
    case 'union':
      return new UnionPullStep(source, op.second as Iterable<any>, op.comparer);
    case 'intersect':
      return new IntersectPullStep(source, op.second as Iterable<any>, op.comparer);
    case 'except':
      return new ExceptPullStep(source, op.second as Iterable<any>, op.comparer);
    case 'unionBy':
      return new UnionByPullStep(source, op.second as Iterable<any>, op.keySelector, op.comparer);
    case 'intersectBy':
      return new IntersectByPullStep(source, op.second as Iterable<any>, op.keySelector, op.comparer);
    case 'exceptBy':
      return new ExceptByPullStep(source, op.second as Iterable<any>, op.keySelector, op.comparer);
    case 'aggregateBy':
      return new AggregateByPullStep(source, op.keySelector, op.seed, op.func, op.comparer);
    case 'zip':
      return new ZipPullStep(source, op.second, op.resultSelector);
    case 'concat':
      return new ConcatPullStep(source, op.second as Iterable<any>);
    case 'reverse':
      return new ReversePullStep(source);
    default:
      return new MaterializingPullStep(source, op);
  }
}

function wrapIterator<T>(it: Iterator<T>): IterableIterator<T> {
  const result = it as any;
  result[Symbol.iterator] = function() { return this; };
  return result;
}

function arrayFastPath<T>(source: T[], ops: PipelineOp<T>[]): IterableIterator<T> {
  // 1-op specialized fast paths
  if (ops.length === 1) {
    const op = ops[0]!;
    switch (op.kind) {
      case 'where':
        return wrapIterator(new ArrayWhereIterator(source, (op as any).predicate));
      case 'select':
        return wrapIterator(new ArraySelectIterator(source, (op as any).selector));
      case 'take':
        return wrapIterator(new ArrayTakeIterator(source, (op as any).count));
      case 'skip':
        return wrapIterator(new ArraySkipIterator(source, (op as any).count));
    }
  }

  // 2-op specialized fast paths
  else if (ops.length === 2 && ops[0]!.kind === 'where' && ops[1]!.kind === 'select') {
    return wrapIterator(new ArrayWhereSelectIterator(source, (ops[0] as any).predicate, (ops[1] as any).selector));
  } else if (ops.length === 2 && ops[0]!.kind === 'where' && ops[1]!.kind === 'take') {
    return wrapIterator(new ArrayWhereTakeIterator(source, (ops[0] as any).predicate, (ops[1] as any).count));
  } else if (ops.length === 2 && ops[0]!.kind === 'select' && ops[1]!.kind === 'take') {
    return wrapIterator(new ArraySelectTakeIterator(source, (ops[0] as any).selector, (ops[1] as any).count));
  }

  // 3-op specialized fast paths
  else if (ops.length === 3 && ops[0]!.kind === 'where' && ops[1]!.kind === 'select' && ops[2]!.kind === 'take') {
    return wrapIterator(new ArrayWhereSelectTakeIterator(
      source,
      (ops[0] as any).predicate,
      (ops[1] as any).selector,
      (ops[2] as any).count
    ));
  } else if (ops.length === 3 && ops[0]!.kind === 'where' && ops[1]!.kind === 'skip' && ops[2]!.kind === 'take') {
    return wrapIterator(new ArrayWhereSkipTakeIterator(
      source,
      (ops[0] as any).predicate,
      (ops[1] as any).count,
      (ops[2] as any).count
    ));
  }

  // Fallback
  let current: PullStep = {
    iterator: source[Symbol.iterator](),
    next() {
      return this.iterator.next();
    }
  } as any;

  for (const op of ops) {
    current = createPullStep(current, op);
  }

  return wrapIterator(current as unknown as Iterator<T>);
}

// -----------------------------------------------------------------------------
// Core Executors
// -----------------------------------------------------------------------------

export function executePipeline<T>(
  source: Iterable<T>,
  pipeline: OpPipeline<T>,
): IterableIterator<T> {
  const ops = pipeline.ops;
  if (ops.length === 0) {
    return wrapIterator(source[Symbol.iterator]());
  }
  if (isArray(source) && canUseArrayFastPath(ops)) {
    return arrayFastPath(source, ops);
  }
  
  let current: PullStep = {
    iterator: source[Symbol.iterator](),
    next() {
      return this.iterator.next();
    }
  } as any;

  for (const op of ops) {
    current = createPullStep(current, op);
  }

  return wrapIterator(current as unknown as Iterator<T>);
}

export function toIterable<T>(source: Iterable<T>, pipeline: OpPipeline<T>): Iterable<T> {
  return {
    [Symbol.iterator]() {
      return executePipeline(source, pipeline);
    },
  };
}

export function executePipelineToArrayFast<T>(source: T[], ops: PipelineOp<any>[]): any[] {
  const steps: {
    kind: 'where' | 'select' | 'take' | 'skip';
    fn?: Function;
    val?: number;
    skipped?: number;
    taken?: number;
  }[] = [];

  for (const op of ops) {
    switch (op.kind) {
      case 'where':
        steps.push({ kind: 'where', fn: (op as any).predicate });
        break;
      case 'select':
        steps.push({ kind: 'select', fn: (op as any).selector });
        break;
      case 'take':
        steps.push({ kind: 'take', val: (op as any).count, taken: 0 });
        break;
      case 'skip':
        steps.push({ kind: 'skip', val: (op as any).count, skipped: 0 });
        break;
    }
  }

  const stepsLen = steps.length;
  const results: any[] = [];
  let index = 0;

  // 1-op optimizations
  if (stepsLen === 1) {
    const step = steps[0]!;
    if (step.kind === 'where') {
      const p = step.fn!;
      for (let i = 0; i < source.length; i++) {
        const item = source[i]!;
        if (p(item, i)) results.push(item);
      }
      return results;
    } else if (step.kind === 'select') {
      const s = step.fn!;
      const results = new Array(source.length);
      for (let i = 0; i < source.length; i++) {
        results[i] = s(source[i]!, i);
      }
      return results;
    } else if (step.kind === 'take') {
      const limit = Math.min(source.length, step.val!);
      const results = new Array(limit);
      for (let i = 0; i < limit; i++) {
        results[i] = source[i];
      }
      return results;
    } else if (step.kind === 'skip') {
      const start = Math.min(source.length, step.val!);
      const results = new Array(source.length - start);
      for (let i = start; i < source.length; i++) {
        results[i - start] = source[i];
      }
      return results;
    }
  }

  // 2-op optimizations
  if (stepsLen === 2) {
    const op1 = steps[0]!;
    const op2 = steps[1]!;
    if (op1.kind === 'where' && op2.kind === 'select') {
      const p = op1.fn!;
      const s = op2.fn!;
      for (let i = 0; i < source.length; i++) {
        const item = source[i]!;
        if (p(item, i)) {
          results.push(s(item, i));
        }
      }
      return results;
    }
    if (op1.kind === 'where' && op2.kind === 'take') {
      const p = op1.fn!;
      const count = op2.val!;
      let taken = 0;
      for (let i = 0; i < source.length; i++) {
        const item = source[i]!;
        if (p(item, i)) {
          results.push(item);
          taken++;
          if (taken >= count) break;
        }
      }
      return results;
    }
    if (op1.kind === 'select' && op2.kind === 'take') {
      const s = op1.fn!;
      const count = Math.min(source.length, op2.val!);
      const results = new Array(count);
      for (let i = 0; i < count; i++) {
        results[i] = s(source[i]!, i);
      }
      return results;
    }
  }

  // 3-op optimizations
  if (stepsLen === 3) {
    const op1 = steps[0]!;
    const op2 = steps[1]!;
    const op3 = steps[2]!;
    if (op1.kind === 'where' && op2.kind === 'select' && op3.kind === 'take') {
      const p = op1.fn!;
      const s = op2.fn!;
      const count = op3.val!;
      let taken = 0;
      for (let i = 0; i < source.length; i++) {
        const item = source[i]!;
        if (p(item, i)) {
          results.push(s(item, i));
          taken++;
          if (taken >= count) break;
        }
      }
      return results;
    }
    if (op1.kind === 'where' && op2.kind === 'skip' && op3.kind === 'take') {
      const p = op1.fn!;
      const skip = op2.val!;
      const take = op3.val!;
      let skipped = 0;
      let taken = 0;
      for (let i = 0; i < source.length; i++) {
        const item = source[i]!;
        if (p(item, i)) {
          if (skipped < skip) {
            skipped++;
          } else {
            results.push(item);
            taken++;
            if (taken >= take) break;
          }
        }
      }
      return results;
    }
  }

  // Fallback for general case
  outer: for (let i = 0; i < source.length; i++) {
    let current: any = source[i];
    for (let j = 0; j < stepsLen; j++) {
      const step = steps[j]!;
      switch (step.kind) {
        case 'where':
          if (!step.fn!(current, index)) {
            index++;
            continue outer;
          }
          break;
        case 'select':
          current = step.fn!(current, index);
          break;
        case 'skip':
          if (step.skipped! < step.val!) {
            step.skipped!++;
            index++;
            continue outer;
          }
          break;
        case 'take':
          if (step.taken! >= step.val!) {
            break outer;
          }
          step.taken!++;
          break;
      }
    }
    results.push(current);

    // Early termination check if all takes are satisfied
    let allTakesDone = true;
    let hasTake = false;
    for (let j = 0; j < stepsLen; j++) {
      const step = steps[j]!;
      if (step.kind === 'take') {
        hasTake = true;
        if (step.taken! < step.val!) {
          allTakesDone = false;
          break;
        }
      }
    }
    if (hasTake && allTakesDone) {
      break;
    }

    index++;
  }

  return results;
}

export function executePipelineToArray<T>(source: Iterable<T>, ops: PipelineOp<any>[]): any[] {
  if (isArray(source)) {
    if (canUseArraySegmentRunner(ops)) {
      return executeArraySegmentRunner(source, ops);
    }
  }
  const results: any[] = [];
  
  let current: PullStep = {
    iterator: source[Symbol.iterator](),
    next() {
      return this.iterator.next();
    }
  } as any;

  for (const op of ops) {
    current = createPullStep(current, op);
  }

  while (true) {
    const res = current.next();
    if (res.done) break;
    results.push(res.value);
  }
  return results;
}

export function executePipelineToCountFast<T>(
  source: T[],
  activeOps: PipelineOp<any>[],
): number {
  const stepsLen = activeOps.length;
  if (stepsLen === 0) {
    return source.length;
  }

  // 1-op where
  if (stepsLen === 1 && activeOps[0]!.kind === 'where') {
    const p = (activeOps[0] as any).predicate;
    let count = 0;
    const len = source.length;
    for (let i = 0; i < len; i++) {
      if (p(source[i]!, i)) count++;
    }
    return count;
  }

  const steps = parseFusibleSteps(activeOps);
  const stepsCount = steps.length;
  let count = 0;
  let index = 0;

  outer: for (let i = 0; i < source.length; i++) {
    let current: any = source[i];
    for (let j = 0; j < stepsCount; j++) {
      const step = steps[j]!;
      switch (step.kind) {
        case 'where':
          if (!step.fn!(current, index)) {
            index++;
            continue outer;
          }
          break;
        case 'select':
          current = step.fn!(current, index);
          break;
        case 'skip':
          if (step.skipped! < step.val!) {
            step.skipped!++;
            index++;
            continue outer;
          }
          break;
        case 'take':
          if (step.taken! >= step.val!) {
            break outer;
          }
          step.taken!++;
          break;
      }
    }
    count++;

    // Early termination check if all takes are satisfied
    let allTakesDone = true;
    let hasTake = false;
    for (let j = 0; j < stepsCount; j++) {
      const step = steps[j]!;
      if (step.kind === 'take') {
        hasTake = true;
        if (step.taken! < step.val!) {
          allTakesDone = false;
          break;
        }
      }
    }
    if (hasTake && allTakesDone) {
      break;
    }

    index++;
  }

  return count;
}

export function executePipelineToCount<T>(
  source: Iterable<T>,
  ops: PipelineOp<any>[],
  predicate?: Predicate<T>
): number {
  const activeOps = predicate
    ? [...ops, { kind: 'where' as const, predicate }]
    : ops;
  if (isArray(source)) {
    if (canUseArrayFastPath(activeOps)) {
      return executePipelineToCountFast(source, activeOps);
    } else if (canUseArraySegmentRunner(activeOps)) {
      const materialized = executeArraySegmentRunner(source, activeOps);
      return materialized.length;
    }
  }
  let count = 0;
  
  let current: PullStep = {
    iterator: source[Symbol.iterator](),
    next() {
      return this.iterator.next();
    }
  } as any;

  for (const op of activeOps) {
    current = createPullStep(current, op);
  }

  while (true) {
    const res = current.next();
    if (res.done) break;
    count++;
  }
  return count;
}

export function executePipelineToSumFast<T>(
  source: T[],
  ops: PipelineOp<any>[],
  selector?: Selector<T, number>,
): number {
  const len = source.length;
  if (len === 0) return 0;
  const opsLen = ops.length;

  // 0-op
  if (opsLen === 0) {
    let sum = 0;
    let compensation = 0;
    if (selector) {
      for (let i = 0; i < len; i++) {
        const value = selector(source[i]!, i);
        const y = value - compensation;
        const t = sum + y;
        compensation = (t - sum) - y;
        sum = t;
      }
    } else {
      for (let i = 0; i < len; i++) {
        const value = source[i] as number;
        const y = value - compensation;
        const t = sum + y;
        compensation = (t - sum) - y;
        sum = t;
      }
    }
    return sum;
  }

  // 1-op where
  if (opsLen === 1 && ops[0]!.kind === 'where') {
    const p = (ops[0] as any).predicate;
    let sum = 0;
    let compensation = 0;
    if (selector) {
      for (let i = 0; i < len; i++) {
        const item = source[i]!;
        if (p(item, i)) {
          const value = selector(item, i);
          const y = value - compensation;
          const t = sum + y;
          compensation = (t - sum) - y;
          sum = t;
        }
      }
    } else {
      for (let i = 0; i < len; i++) {
        const item = source[i]!;
        if (p(item, i)) {
          const value = item as number;
          const y = value - compensation;
          const t = sum + y;
          compensation = (t - sum) - y;
          sum = t;
        }
      }
    }
    return sum;
  }

  // 2-op where + select
  if (opsLen === 2 && ops[0]!.kind === 'where' && ops[1]!.kind === 'select') {
    const p = (ops[0] as any).predicate;
    const s = (ops[1] as any).selector;
    let sum = 0;
    let compensation = 0;
    for (let i = 0; i < len; i++) {
      const item = source[i]!;
      if (p(item, i)) {
        const mapped = s(item, i);
        const value = selector ? selector(mapped, i) : (mapped as number);
        const y = value - compensation;
        const t = sum + y;
        compensation = (t - sum) - y;
        sum = t;
      }
    }
    return sum;
  }

  // 3-op where + select + take
  if (opsLen === 3 && ops[0]!.kind === 'where' && ops[1]!.kind === 'select' && ops[2]!.kind === 'take') {
    const p = (ops[0] as any).predicate;
    const s = (ops[1] as any).selector;
    const count = (ops[2] as any).count;
    let sum = 0;
    let compensation = 0;
    let taken = 0;
    for (let i = 0; i < len; i++) {
      const item = source[i]!;
      if (p(item, i)) {
        const mapped = s(item, i);
        const value = selector ? selector(mapped, i) : (mapped as number);
        const y = value - compensation;
        const t = sum + y;
        compensation = (t - sum) - y;
        sum = t;
        taken++;
        if (taken >= count) break;
      }
    }
    return sum;
  }

  // Fallback for general array case
  const steps = parseFusibleSteps(ops);
  let sum = 0;
  let compensation = 0;
  forEachFusible(source, steps, (item, index) => {
    const value = selector ? selector(item as T, index) : (item as number);
    const y = value - compensation;
    const t = sum + y;
    compensation = (t - sum) - y;
    sum = t;
  });
  return sum;
}

export function executePipelineToSum<T>(
  source: Iterable<T>,
  ops: PipelineOp<any>[],
  selector?: Selector<T, number>,
): number {
  if (isArray(source)) {
    if (canUseArrayFastPath(ops)) {
      return executePipelineToSumFast(source, ops, selector);
    } else if (canUseArraySegmentRunner(ops)) {
      const materialized = executeArraySegmentRunner(source, ops);
      return executePipelineToSumFast(materialized, [], selector);
    }
  }
  let sum = 0;
  let compensation = 0;
  let index = 0;
  for (const item of executePipeline(source, { ops } as OpPipeline<T>)) {
    const value = selector ? selector(item, index) : (item as number);
    const y = value - compensation;
    const t = sum + y;
    compensation = (t - sum) - y;
    sum = t;
    index++;
  }
  return sum;
}

export function executePipelineToAll<T>(
  source: Iterable<T>,
  ops: PipelineOp<any>[],
  predicate: Predicate<T>,
): boolean {
  if (isArray(source)) {
    if (canUseArrayFastPath(ops)) {
      const len = source.length;
      if (ops.length === 0) {
        if (predicate.length <= 1) {
          for (let i = 0; i < len; i++) {
            if (!predicate(source[i]!)) return false;
          }
        } else {
          for (let i = 0; i < len; i++) {
            if (!predicate(source[i]!, i)) return false;
          }
        }
        return true;
      }
      if (ops.length === 1 && ops[0]!.kind === 'where') {
        const p = (ops[0] as any).predicate;
        if (predicate.length <= 1) {
          for (let i = 0; i < len; i++) {
            const item = source[i]!;
            if (p(item, i)) {
              if (!predicate(item)) return false;
            }
          }
        } else {
          for (let i = 0; i < len; i++) {
            const item = source[i]!;
            if (p(item, i)) {
              if (!predicate(item, i)) return false;
            }
          }
        }
        return true;
      }
      // General fusible steps
      const steps = parseFusibleSteps(ops);
      let index = 0;
      let allPassed = true;
      forEachFusible(source, steps, (item) => {
        if (!predicate(item as T, index++)) {
          allPassed = false;
          return false; // Stop early
        }
      });
      return allPassed;
    }
  }

  let index = 0;
  for (const item of executePipeline(source, { ops } as OpPipeline<T>)) {
    if (!predicate(item, index++)) return false;
  }
  return true;
}

export function executePipelineToAny<T>(
  source: Iterable<T>,
  ops: PipelineOp<any>[],
  predicate?: Predicate<T>,
): boolean {
  if (isArray(source)) {
    if (canUseArrayFastPath(ops)) {
      const len = source.length;
      if (ops.length === 0) {
        if (predicate) {
          if (predicate.length <= 1) {
            for (let i = 0; i < len; i++) {
              if (predicate(source[i]!)) return true;
            }
          } else {
            for (let i = 0; i < len; i++) {
              if (predicate(source[i]!, i)) return true;
            }
          }
          return false;
        }
        return len > 0;
      }
      if (ops.length === 1 && ops[0]!.kind === 'where') {
        const p = (ops[0] as any).predicate;
        if (predicate) {
          if (predicate.length <= 1) {
            for (let i = 0; i < len; i++) {
              const item = source[i]!;
              if (p(item, i) && predicate(item)) return true;
            }
          } else {
            for (let i = 0; i < len; i++) {
              const item = source[i]!;
              if (p(item, i) && predicate(item, i)) return true;
            }
          }
          return false;
        }
        for (let i = 0; i < len; i++) {
          if (p(source[i]!, i)) return true;
        }
        return false;
      }
      // General fusible steps
      const steps = parseFusibleSteps(ops);
      let index = 0;
      let found = false;
      forEachFusible(source, steps, (item) => {
        if (predicate) {
          if (predicate(item as T, index++)) {
            found = true;
            return false; // Stop early
          }
        } else {
          found = true;
          return false; // Stop early
        }
      });
      return found;
    }
  }

  let index = 0;
  for (const item of executePipeline(source, { ops } as OpPipeline<T>)) {
    if (predicate) {
      if (predicate(item, index++)) return true;
    } else {
      return true;
    }
  }
  return false;
}

export function executePipelineToAverage<T>(
  source: Iterable<T>,
  ops: PipelineOp<any>[],
  selector?: Selector<T, number>,
): number {
  if (isArray(source)) {
    if (canUseArrayFastPath(ops)) {
      let sum = 0;
      let compensation = 0;
      let count = 0;
      const len = source.length;

      // 0-op
      if (ops.length === 0) {
        if (len === 0) throw new EmptySequenceError();
        if (selector) {
          for (let i = 0; i < len; i++) {
            const value = selector(source[i]!, i);
            const y = value - compensation;
            const t = sum + y;
            compensation = (t - sum) - y;
            sum = t;
            count++;
          }
        } else {
          for (let i = 0; i < len; i++) {
            const value = source[i] as number;
            const y = value - compensation;
            const t = sum + y;
            compensation = (t - sum) - y;
            sum = t;
            count++;
          }
        }
        return sum / count;
      }

      // 1-op where
      if (ops.length === 1 && ops[0]!.kind === 'where') {
        const p = (ops[0] as any).predicate;
        if (selector) {
          for (let i = 0; i < len; i++) {
            const item = source[i]!;
            if (p(item, i)) {
              const value = selector(item, i);
              const y = value - compensation;
              const t = sum + y;
              compensation = (t - sum) - y;
              sum = t;
              count++;
            }
          }
        } else {
          for (let i = 0; i < len; i++) {
            const item = source[i]!;
            if (p(item, i)) {
              const value = item as number;
              const y = value - compensation;
              const t = sum + y;
              compensation = (t - sum) - y;
              sum = t;
              count++;
            }
          }
        }
        if (count === 0) throw new EmptySequenceError();
        return sum / count;
      }

      // 2-op where + select
      if (ops.length === 2 && ops[0]!.kind === 'where' && ops[1]!.kind === 'select') {
        const p = (ops[0] as any).predicate;
        const s = (ops[1] as any).selector;
        for (let i = 0; i < len; i++) {
          const item = source[i]!;
          if (p(item, i)) {
            const mapped = s(item, i);
            const value = selector ? selector(mapped, i) : (mapped as number);
            const y = value - compensation;
            const t = sum + y;
            compensation = (t - sum) - y;
            sum = t;
            count++;
          }
        }
        if (count === 0) throw new EmptySequenceError();
        return sum / count;
      }

      // Fallback for array fast path
      const steps = parseFusibleSteps(ops);
      forEachFusible(source, steps, (item, index) => {
        const value = selector ? selector(item as T, index) : (item as number);
        const y = value - compensation;
        const t = sum + y;
        compensation = (t - sum) - y;
        sum = t;
        count++;
      });
      if (count === 0) throw new EmptySequenceError();
      return sum / count;
    }
  }

  // General fallback
  let sum = 0;
  let compensation = 0;
  let count = 0;
  let index = 0;
  for (const item of executePipeline(source, { ops } as OpPipeline<T>)) {
    const value = selector ? selector(item, index) : (item as number);
    const y = value - compensation;
    const t = sum + y;
    compensation = (t - sum) - y;
    sum = t;
    count++;
    index++;
  }
  if (count === 0) throw new EmptySequenceError();
  return sum / count;
}

export function executePipelineToFirst<T>(
  source: Iterable<T>,
  ops: PipelineOp<any>[],
  predicate?: Predicate<T>,
): T {
  const activeOps = predicate
    ? [...ops, { kind: 'where' as const, predicate }]
    : ops;
  const lenOps = activeOps.length;
  if (lenOps > 0 && activeOps[lenOps - 1]!.kind === 'orderBy') {
    const orderByOp = activeOps[lenOps - 1] as PipelineOp<any> & { kind: 'orderBy' };
    const precedingOps = activeOps.slice(0, lenOps - 1);
    const keys = orderByOp.keys;
    const numKeys = keys.length;
    let minItem: any = null;
    let minKeys: any[] = [];
    let hasAny = false;
    let index = 0;
    for (const item of executePipeline(source, { ops: precedingOps } as any)) {
      if (!hasAny) {
        minItem = item;
        minKeys = new Array(numKeys);
        for (let k = 0; k < numKeys; k++) {
          minKeys[k] = keys[k]!.key(item, index);
        }
        hasAny = true;
      } else {
        const itemKeys = new Array(numKeys);
        for (let k = 0; k < numKeys; k++) {
          itemKeys[k] = keys[k]!.key(item, index);
        }
        let cmp = 0;
        for (let k = 0; k < numKeys; k++) {
          cmp = compareOrderKeys(itemKeys[k], minKeys[k], keys[k]!);
          if (cmp !== 0) break;
        }
        if (cmp < 0) {
          minItem = item;
          minKeys = itemKeys;
        }
      }
      index++;
    }
    if (!hasAny) throw new EmptySequenceError();
    return minItem;
  }
  if (isArray(source)) {
    if (canUseArrayFastPath(activeOps)) {
      const len = source.length;
      if (activeOps.length === 0) {
        if (len === 0) throw new EmptySequenceError();
        return source[0]!;
      }
      if (activeOps.length === 1 && activeOps[0]!.kind === 'where') {
        const p = (activeOps[0] as any).predicate;
        if (p.length <= 1) {
          for (let i = 0; i < len; i++) {
            const item = source[i]!;
            if (p(item)) return item;
          }
        } else {
          for (let i = 0; i < len; i++) {
            const item = source[i]!;
            if (p(item, i)) return item;
          }
        }
        throw new EmptySequenceError();
      }
      // General fusible steps
      const steps = parseFusibleSteps(activeOps as any);
      let foundVal: any;
      let found = false;
      forEachFusible(source, steps, (item) => {
        foundVal = item;
        found = true;
        return false; // Stop early
      });
      if (!found) throw new EmptySequenceError();
      return foundVal;
    }
  }

  let index = 0;
  for (const item of executePipeline(source, { ops: activeOps } as OpPipeline<T>)) {
    return item;
  }
  throw new EmptySequenceError();
}

export function executePipelineToFirstOrDefault<T>(
  source: Iterable<T>,
  ops: PipelineOp<any>[],
  defaultValue: T,
  predicate?: Predicate<T>,
): T {
  try {
    return executePipelineToFirst(source, ops, predicate);
  } catch (err) {
    if (err instanceof EmptySequenceError) {
      return defaultValue;
    }
    throw err;
  }
}

export function executePipelineToLast<T>(
  source: Iterable<T>,
  ops: PipelineOp<any>[],
  predicate?: Predicate<T>,
): T {
  const activeOps = predicate
    ? [...ops, { kind: 'where' as const, predicate }]
    : ops;
  const lenOps = activeOps.length;
  if (lenOps > 0 && activeOps[lenOps - 1]!.kind === 'orderBy') {
    const orderByOp = activeOps[lenOps - 1] as PipelineOp<any> & { kind: 'orderBy' };
    const precedingOps = activeOps.slice(0, lenOps - 1);
    const keys = orderByOp.keys;
    const numKeys = keys.length;
    let maxItem: any = null;
    let maxKeys: any[] = [];
    let hasAny = false;
    let index = 0;
    for (const item of executePipeline(source, { ops: precedingOps } as any)) {
      if (!hasAny) {
        maxItem = item;
        maxKeys = new Array(numKeys);
        for (let k = 0; k < numKeys; k++) {
          maxKeys[k] = keys[k]!.key(item, index);
        }
        hasAny = true;
      } else {
        const itemKeys = new Array(numKeys);
        for (let k = 0; k < numKeys; k++) {
          itemKeys[k] = keys[k]!.key(item, index);
        }
        let cmp = 0;
        for (let k = 0; k < numKeys; k++) {
          cmp = compareOrderKeys(itemKeys[k], maxKeys[k], keys[k]!);
          if (cmp !== 0) break;
        }
        if (cmp >= 0) {
          maxItem = item;
          maxKeys = itemKeys;
        }
      }
      index++;
    }
    if (!hasAny) throw new EmptySequenceError();
    return maxItem;
  }
  if (isArray(source)) {
    if (canUseArrayFastPath(activeOps)) {
      const len = source.length;
      if (activeOps.length === 0) {
        if (len === 0) throw new EmptySequenceError();
        return source[len - 1]!;
      }
      if (activeOps.length === 1 && activeOps[0]!.kind === 'where') {
        const p = (activeOps[0] as any).predicate;
        if (p.length <= 1) {
          for (let i = len - 1; i >= 0; i--) {
            const item = source[i]!;
            if (p(item)) return item;
          }
        } else {
          for (let i = len - 1; i >= 0; i--) {
            const item = source[i]!;
            if (p(item, i)) return item;
          }
        }
        throw new EmptySequenceError();
      }
      // General fusible steps
      const steps = parseFusibleSteps(activeOps as any);
      let foundVal: any;
      let found = false;
      forEachFusible(source, steps, (item) => {
        foundVal = item;
        found = true;
      });
      if (!found) throw new EmptySequenceError();
      return foundVal;
    }
  }

  let foundVal: any;
  let found = false;
  for (const item of executePipeline(source, { ops: activeOps } as OpPipeline<T>)) {
    foundVal = item;
    found = true;
  }
  if (!found) throw new EmptySequenceError();
  return foundVal;
}

export function executePipelineToLastOrDefault<T>(
  source: Iterable<T>,
  ops: PipelineOp<any>[],
  defaultValue: T,
  predicate?: Predicate<T>,
): T {
  try {
    return executePipelineToLast(source, ops, predicate);
  } catch (err) {
    if (err instanceof EmptySequenceError) {
      return defaultValue;
    }
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Array Segment Runner & Helpers
// -----------------------------------------------------------------------------

function siftUp(heap: Int32Array | number[], index: number, compare: (i: number, j: number) => number) {
  while (index > 0) {
    const parent = (index - 1) >> 1;
    if (compare(heap[index]!, heap[parent]!) > 0) {
      const temp = heap[index]!;
      heap[index] = heap[parent]!;
      heap[parent] = temp;
      index = parent;
    } else {
      break;
    }
  }
}

function siftDown(heap: Int32Array | number[], index: number, size: number, compare: (i: number, j: number) => number) {
  const half = size >> 1;
  while (index < half) {
    let child = (index << 1) + 1;
    let right = child + 1;
    if (right < size && compare(heap[right]!, heap[child]!) > 0) {
      child = right;
    }
    if (compare(heap[child]!, heap[index]!) > 0) {
      const temp = heap[index]!;
      heap[index] = heap[child]!;
      heap[child] = temp;
      index = child;
    } else {
      break;
    }
  }
}



export function executeOrderByTake<T>(
  arr: T[],
  orderByOp: PipelineOp<any> & { kind: 'orderBy' },
  K: number
): T[] {
  const len = arr.length;
  if (len === 0 || K <= 0) return [];
  if (K >= len) {
    stableSortInPlace(arr, orderByOp.keys);
    return arr;
  }

  const keys = orderByOp.keys;
  const numKeys = keys.length;
  const keysArrays = new Array(numKeys);
  for (let k = 0; k < numKeys; k++) {
    const entry = keys[k]!;
    const keyArr = new Array(len);
    const keyFn = entry.key;
    for (let i = 0; i < len; i++) {
      keyArr[i] = keyFn(arr[i]!, i);
    }
    keysArrays[k] = keyArr;
  }

  const compareIndices = (i: number, j: number): number => {
    for (let k = 0; k < numKeys; k++) {
      const keyArr = keysArrays[k]!;
      const ka = keyArr[i];
      const kb = keyArr[j];
      const cmp = compareOrderKeys(ka, kb, keys[k]!);
      if (cmp !== 0) return cmp;
    }
    return i - j;
  };

  const heapCompare = compareIndices;

  const heap = len > 1000 ? new Int32Array(K) : new Array(K);
  for (let i = 0; i < K; i++) {
    heap[i] = i;
  }
  for (let i = 1; i < K; i++) {
    siftUp(heap, i, heapCompare);
  }

  for (let i = K; i < len; i++) {
    if (heapCompare(i, heap[0]!) < 0) {
      heap[0] = i;
      siftDown(heap, 0, K, heapCompare);
    }
  }

  const heapSlice = Array.from(heap);
  heapSlice.sort(compareIndices);

  const result = new Array(K);
  for (let i = 0; i < K; i++) {
    result[i] = arr[heapSlice[i]!]!;
  }
  return result;
}

function executeMaterializingOpWithLazy(arr: any[], lazyOps: PipelineOp<any>[], op: PipelineOp<any>): any[] {
  const kind = op.kind;
  const steps = parseFusibleSteps(lazyOps);
  
  if (kind === 'orderBy') {
    const collected: any[] = [];
    forEachFusible(arr, steps, (item) => {
      collected.push(item);
    });
    stableSortInPlace(collected, (op as any).keys);
    return collected;
  }
  if (kind === 'reverse') {
    const collected: any[] = [];
    forEachFusible(arr, steps, (item) => {
      collected.push(item);
    });
    return collected.reverse();
  }
  if (kind === 'distinct') {
    const comparer = (op as any).comparer;
    const seen = new Set();
    const res: any[] = [];
    if (!comparer) {
      forEachFusible(arr, steps, (v) => {
        if (!seen.has(v)) {
          seen.add(v);
          res.push(v);
        }
      });
    } else {
      forEachFusible(arr, steps, (v) => {
        if (!res.some(x => comparer(x, v))) {
          res.push(v);
        }
      });
    }
    return res;
  }
  if (kind === 'distinctBy') {
    const selector = (op as any).keySelector;
    const comparer = (op as any).comparer;
    const seen = new Set();
    const res: any[] = [];
    if (!comparer) {
      forEachFusible(arr, steps, (item, idx) => {
        const key = selector(item, idx);
        if (!seen.has(key)) {
          seen.add(key);
          res.push(item);
        }
      });
    } else {
      const seenKeys: any[] = [];
      forEachFusible(arr, steps, (item, idx) => {
        const key = selector(item, idx);
        if (!seenKeys.some(x => comparer(x, key))) {
          seenKeys.push(key);
          res.push(item);
        }
      });
    }
    return res;
  }
  if (kind === 'groupBy') {
    const map = new Map<any, any[]>();
    const keySelector = (op as any).keySelector;
    const elementSelector = (op as any).elementSelector;
    if (steps.length === 0) {
      const len = arr.length;
      for (let idx = 0; idx < len; idx++) {
        const item = arr[idx]!;
        const key = keySelector(item, idx);
        const element = elementSelector ? elementSelector(item, idx) : item;
        const bucket = map.get(key);
        if (bucket) bucket.push(element);
        else map.set(key, [element]);
      }
    } else {
      forEachFusible(arr, steps, (item, idx) => {
        const key = keySelector(item, idx);
        const element = elementSelector ? elementSelector(item, idx) : item;
        const bucket = map.get(key);
        if (bucket) bucket.push(element);
        else map.set(key, [element]);
      });
    }
    const groupings: Grouping<any, any>[] = [];
    for (const [key, elements] of map) {
      groupings.push(new Grouping(key, elements));
    }
    return groupings as any[];
  }
  if (kind === 'join') {
    const { lookup, eq, isDefault, hasDuplicates } = buildJoinLookup((op as any).inner, (op as any).innerKeySelector, (op as any).comparer);
    const results: any[] = [];
    const outerKeySelector = (op as any).outerKeySelector;
    const resultSelector = (op as any).resultSelector;
    if (steps.length === 0) {
      const len = arr.length;
      if (isDefault) {
        if (hasDuplicates) {
          for (let idx = 0; idx < len; idx++) {
            const outerItem = arr[idx]!;
            const key = outerKeySelector(outerItem, idx);
            const matches = lookup.useArr
              ? lookup.arr![key as number]
              : lookup.useObj
              ? lookup.obj![key as any]
              : lookup.map.get(key);
            if (matches !== undefined) {
              if (Array.isArray(matches)) {
                const mLen = matches.length;
                for (let j = 0; j < mLen; j++) {
                  results.push(resultSelector(outerItem, matches[j]));
                }
              } else {
                results.push(resultSelector(outerItem, matches));
              }
            }
          }
        } else {
          const lookupArr = lookup.arr;
          const lookupObj = lookup.obj;
          const lookupMap = lookup.map;
          const useArr = lookup.useArr;
          const useObj = lookup.useObj;
          for (let idx = 0; idx < len; idx++) {
            const outerItem = arr[idx]!;
            const key = outerKeySelector(outerItem, idx);
            const matches = useArr
              ? lookupArr![key as number]
              : useObj
              ? lookupObj![key as any]
              : lookupMap.get(key);
            if (matches !== undefined) {
              results.push(resultSelector(outerItem, matches));
            }
          }
        }
      } else {
        for (let idx = 0; idx < len; idx++) {
          const outerItem = arr[idx]!;
          const key = outerKeySelector(outerItem, idx);
          const matches = findJoinMatches(lookup, key, eq, false);
          const mLen = matches.length;
          for (let j = 0; j < mLen; j++) {
            results.push(resultSelector(outerItem, matches[j]));
          }
        }
      }
    } else {
      if (isDefault) {
        if (hasDuplicates) {
          forEachFusible(arr, steps, (outerItem, idx) => {
            const key = outerKeySelector(outerItem, idx);
            const matches = lookup.useArr
              ? lookup.arr![key as number]
              : lookup.useObj
              ? lookup.obj![key as any]
              : lookup.map.get(key);
            if (matches !== undefined) {
              if (Array.isArray(matches)) {
                const mLen = matches.length;
                for (let j = 0; j < mLen; j++) {
                  results.push(resultSelector(outerItem, matches[j]));
                }
              } else {
                results.push(resultSelector(outerItem, matches));
              }
            }
          });
        } else {
          const lookupArr = lookup.arr;
          const lookupObj = lookup.obj;
          const lookupMap = lookup.map;
          const useArr = lookup.useArr;
          const useObj = lookup.useObj;
          forEachFusible(arr, steps, (outerItem, idx) => {
            const key = outerKeySelector(outerItem, idx);
            const matches = useArr
              ? lookupArr![key as number]
              : useObj
              ? lookupObj![key as any]
              : lookupMap.get(key);
            if (matches !== undefined) {
              results.push(resultSelector(outerItem, matches));
            }
          });
        }
      } else {
        forEachFusible(arr, steps, (outerItem, idx) => {
          const key = outerKeySelector(outerItem, idx);
          const matches = findJoinMatches(lookup, key, eq, false);
          const mLen = matches.length;
          for (let j = 0; j < mLen; j++) {
            results.push(resultSelector(outerItem, matches[j]));
          }
        });
      }
    }
    return results;
  }
  if (kind === 'leftJoin') {
    const { lookup, eq, isDefault, hasDuplicates } = buildJoinLookup((op as any).inner, (op as any).innerKeySelector, (op as any).comparer);
    const results: any[] = [];
    const outerKeySelector = (op as any).outerKeySelector;
    const resultSelector = (op as any).resultSelector;
    if (steps.length === 0) {
      const len = arr.length;
      if (isDefault) {
        if (hasDuplicates) {
          for (let idx = 0; idx < len; idx++) {
            const outerItem = arr[idx]!;
            const key = outerKeySelector(outerItem, idx);
            const matches = lookup.useArr
              ? lookup.arr![key as number]
              : lookup.useObj
              ? lookup.obj![key as any]
              : lookup.map.get(key);
            if (matches !== undefined) {
              if (Array.isArray(matches)) {
                const mLen = matches.length;
                for (let j = 0; j < mLen; j++) {
                  results.push(resultSelector(outerItem, matches[j]));
                }
              } else {
                results.push(resultSelector(outerItem, matches));
              }
            } else {
              results.push(resultSelector(outerItem, null));
            }
          }
        } else {
          const lookupArr = lookup.arr;
          const lookupObj = lookup.obj;
          const lookupMap = lookup.map;
          const useArr = lookup.useArr;
          const useObj = lookup.useObj;
          for (let idx = 0; idx < len; idx++) {
            const outerItem = arr[idx]!;
            const key = outerKeySelector(outerItem, idx);
            const matches = useArr
              ? lookupArr![key as number]
              : useObj
              ? lookupObj![key as any]
              : lookupMap.get(key);
            if (matches !== undefined) {
              results.push(resultSelector(outerItem, matches));
            } else {
              results.push(resultSelector(outerItem, null));
            }
          }
        }
      } else {
        for (let idx = 0; idx < len; idx++) {
          const outerItem = arr[idx]!;
          const key = outerKeySelector(outerItem, idx);
          const matches = findJoinMatches(lookup, key, eq, false);
          const mLen = matches.length;
          if (mLen === 0) {
            results.push(resultSelector(outerItem, null));
          } else {
            for (let j = 0; j < mLen; j++) {
              results.push(resultSelector(outerItem, matches[j]));
            }
          }
        }
      }
    } else {
      if (isDefault) {
        if (hasDuplicates) {
          forEachFusible(arr, steps, (outerItem, idx) => {
            const key = outerKeySelector(outerItem, idx);
            const matches = lookup.useArr
              ? lookup.arr![key as number]
              : lookup.useObj
              ? lookup.obj![key as any]
              : lookup.map.get(key);
            if (matches !== undefined) {
              if (Array.isArray(matches)) {
                const mLen = matches.length;
                for (let j = 0; j < mLen; j++) {
                  results.push(resultSelector(outerItem, matches[j]));
                }
              } else {
                results.push(resultSelector(outerItem, matches));
              }
            } else {
              results.push(resultSelector(outerItem, null));
            }
          });
        } else {
          const lookupArr = lookup.arr;
          const lookupObj = lookup.obj;
          const lookupMap = lookup.map;
          const useArr = lookup.useArr;
          const useObj = lookup.useObj;
          forEachFusible(arr, steps, (outerItem, idx) => {
            const key = outerKeySelector(outerItem, idx);
            const matches = useArr
              ? lookupArr![key as number]
              : useObj
              ? lookupObj![key as any]
              : lookupMap.get(key);
            if (matches !== undefined) {
              results.push(resultSelector(outerItem, matches));
            } else {
              results.push(resultSelector(outerItem, null));
            }
          });
        }
      } else {
        forEachFusible(arr, steps, (outerItem, idx) => {
          const key = outerKeySelector(outerItem, idx);
          const matches = findJoinMatches(lookup, key, eq, false);
          const mLen = matches.length;
          if (mLen === 0) {
            results.push(resultSelector(outerItem, null));
          } else {
            for (let j = 0; j < mLen; j++) {
              results.push(resultSelector(outerItem, matches[j]));
            }
          }
        });
      }
    }
    return results;
  }
  if (kind === 'rightJoin') {
    const outerItems: any[] = [];
    forEachFusible(arr, steps, (item) => {
      outerItems.push(item);
    });
    const { lookup, eq, isDefault } = buildJoinLookup(outerItems, (op as any).outerKeySelector, (op as any).comparer);
    const results: any[] = [];
    const innerKeySelector = (op as any).innerKeySelector;
    const resultSelector = (op as any).resultSelector;
    let innerIndex = 0;
    for (const innerItem of (op as any).inner) {
      const key = innerKeySelector(innerItem, innerIndex++);
      if (isDefault) {
        const matches = lookup.get(key);
        if (matches !== undefined) {
          if (Array.isArray(matches)) {
            const mLen = matches.length;
            for (let j = 0; j < mLen; j++) {
              results.push(resultSelector(matches[j], innerItem));
            }
          } else {
            results.push(resultSelector(matches, innerItem));
          }
        } else {
          results.push(resultSelector(null, innerItem));
        }
      } else {
        const matches = findJoinMatches(lookup, key, eq, false);
        const mLen = matches.length;
        if (mLen === 0) {
          results.push(resultSelector(null, innerItem));
        } else {
          for (let j = 0; j < mLen; j++) {
            results.push(resultSelector(matches[j], innerItem));
          }
        }
      }
    }
    return results;
  }
  if (kind === 'fullJoin') {
    const innerList = [...(op as any).inner];
    const { lookup, eq, isDefault } = buildJoinLookup(innerList, (op as any).innerKeySelector, (op as any).comparer);
    const matchedInner = new Set<any>();
    const results: any[] = [];
    const outerKeySelector = (op as any).outerKeySelector;
    const resultSelector = (op as any).resultSelector;
    forEachFusible(arr, steps, (outerItem, idx) => {
      const key = outerKeySelector(outerItem, idx);
      if (isDefault) {
        const matches = lookup.get(key);
        if (matches !== undefined) {
          if (Array.isArray(matches)) {
            const mLen = matches.length;
            for (let j = 0; j < mLen; j++) {
              const innerItem = matches[j];
              matchedInner.add(innerItem);
              results.push(resultSelector(outerItem, innerItem));
            }
          } else {
            matchedInner.add(matches);
            results.push(resultSelector(outerItem, matches));
          }
        } else {
          results.push(resultSelector(outerItem, null));
        }
      } else {
        const matches = findJoinMatches(lookup, key, eq, false);
        const mLen = matches.length;
        if (mLen === 0) {
          results.push(resultSelector(outerItem, null));
        } else {
          for (let j = 0; j < mLen; j++) {
            const innerItem = matches[j];
            matchedInner.add(innerItem);
            results.push(resultSelector(outerItem, innerItem));
          }
        }
      }
    });
    for (let j = 0; j < innerList.length; j++) {
      const innerItem = innerList[j];
      if (!matchedInner.has(innerItem)) {
        results.push(resultSelector(null, innerItem));
      }
    }
    return results;
  }
  if (kind === 'groupJoin') {
    const isDefault = (op as any).comparer === undefined;
    const eq = (op as any).comparer ?? (Object.is as EqualityComparer<any>);
    const innerLookup = new Map<unknown, any[]>();
    const innerKeySelector = (op as any).innerKeySelector;
    const outerKeySelector = (op as any).outerKeySelector;
    const resultSelector = (op as any).resultSelector;
    let innerIndex = 0;
    for (const item of (op as any).inner) {
      const key = innerKeySelector(item, innerIndex++);
      const list = innerLookup.get(key);
      if (list) list.push(item);
      else innerLookup.set(key, [item]);
    }
    const results: any[] = [];
    forEachFusible(arr, steps, (outerItem, idx) => {
      const key = outerKeySelector(outerItem, idx);
      let matches: any[];
      if (isDefault) {
        matches = innerLookup.get(key) ?? [];
      } else {
        matches = [];
        for (const [storedKey, inners] of innerLookup) {
          if (eq(storedKey, key)) {
            const innersLen = inners.length;
            for (let k = 0; k < innersLen; k++) {
              matches.push(inners[k]);
            }
          }
        }
      }
      results.push(resultSelector(outerItem, matches));
    });
    return results;
  }
  if (kind === 'zip') {
    const results: any[] = [];
    const secondIterator = (op as any).second[Symbol.iterator]();
    const resultSelector = (op as any).resultSelector;
    forEachFusible(arr, steps, (item) => {
      const secondRes = secondIterator.next();
      if (secondRes.done) return false;
      results.push(resultSelector(item, secondRes.value));
    });
    return results;
  }
  if (kind === 'concat') {
    const collected: any[] = [];
    forEachFusible(arr, steps, (item) => {
      collected.push(item);
    });
    return collected.concat([...(op as any).second]);
  }
  if (kind === 'union') {
    const seen = new Set();
    const results: any[] = [];
    const comparer = (op as any).comparer;
    if (!comparer) {
      forEachFusible(arr, steps, (v) => {
        if (!seen.has(v)) {
          seen.add(v);
          results.push(v);
        }
      });
      for (const item of (op as any).second) {
        if (!seen.has(item)) {
          seen.add(item);
          results.push(item);
        }
      }
    } else {
      forEachFusible(arr, steps, (v) => {
        if (!results.some(x => comparer(x, v))) {
          results.push(v);
        }
      });
      for (const item of (op as any).second) {
        if (!results.some(x => comparer(x, item))) {
          results.push(item);
        }
      }
    }
    return results;
  }
  if (kind === 'intersect') {
    const comparer = (op as any).comparer;
    if (!comparer) {
      const secondSet = new Set((op as any).second);
      const seen = new Set();
      const results: any[] = [];
      forEachFusible(arr, steps, (v) => {
        if (secondSet.has(v) && !seen.has(v)) {
          seen.add(v);
          results.push(v);
        }
      });
      return results;
    } else {
      const secondList = [...(op as any).second];
      const results: any[] = [];
      forEachFusible(arr, steps, (v) => {
        if (secondList.some(x => comparer(x, v)) && !results.some(x => comparer(x, v))) {
          results.push(v);
        }
      });
      return results;
    }
  }
  if (kind === 'except') {
    const comparer = (op as any).comparer;
    if (!comparer) {
      const secondSet = new Set((op as any).second);
      const seen = new Set();
      const results: any[] = [];
      forEachFusible(arr, steps, (v) => {
        if (!secondSet.has(v) && !seen.has(v)) {
          seen.add(v);
          results.push(v);
        }
      });
      return results;
    } else {
      const secondList = [...(op as any).second];
      const results: any[] = [];
      forEachFusible(arr, steps, (v) => {
        if (!secondList.some(x => comparer(x, v)) && !results.some(x => comparer(x, v))) {
          results.push(v);
        }
      });
      return results;
    }
  }
  if (kind === 'unionBy') {
    const keySelector = (op as any).keySelector;
    const comparer = (op as any).comparer;
    const seenKeys = new Set();
    const results: any[] = [];
    if (!comparer) {
      forEachFusible(arr, steps, (item, idx) => {
        const key = keySelector(item, idx);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push(item);
        }
      });
      let secondIndex = 0;
      for (const item of (op as any).second) {
        const key = keySelector(item, secondIndex++);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          results.push(item);
        }
      }
    } else {
      const seenKeysList: any[] = [];
      forEachFusible(arr, steps, (item, idx) => {
        const key = keySelector(item, idx);
        if (!seenKeysList.some(x => comparer(x, key))) {
          seenKeysList.push(key);
          results.push(item);
        }
      });
      let secondIndex = 0;
      for (const item of (op as any).second) {
        const key = keySelector(item, secondIndex++);
        if (!seenKeysList.some(x => comparer(x, key))) {
          seenKeysList.push(key);
          results.push(item);
        }
      }
    }
    return results;
  }
  if (kind === 'intersectBy') {
    const keySelector = (op as any).keySelector;
    const comparer = (op as any).comparer;
    const results: any[] = [];
    if (!comparer) {
      const secondKeys = new Set((op as any).second);
      const seenKeys = new Set();
      forEachFusible(arr, steps, (item, idx) => {
        const key = keySelector(item, idx);
        if (secondKeys.has(key) && !seenKeys.has(key)) {
          seenKeys.add(key);
          results.push(item);
        }
      });
    } else {
      const secondKeysList = [...(op as any).second];
      const seenKeysList: any[] = [];
      forEachFusible(arr, steps, (item, idx) => {
        const key = keySelector(item, idx);
        if (secondKeysList.some(x => comparer(x, key)) && !seenKeysList.some(x => comparer(x, key))) {
          seenKeysList.push(key);
          results.push(item);
        }
      });
    }
    return results;
  }
  if (kind === 'exceptBy') {
    const keySelector = (op as any).keySelector;
    const comparer = (op as any).comparer;
    const results: any[] = [];
    if (!comparer) {
      const secondKeys = new Set((op as any).second);
      const seenKeys = new Set();
      forEachFusible(arr, steps, (item, idx) => {
        const key = keySelector(item, idx);
        if (!secondKeys.has(key) && !seenKeys.has(key)) {
          seenKeys.add(key);
          results.push(item);
        }
      });
    } else {
      const secondKeysList = [...(op as any).second];
      const seenKeysList: any[] = [];
      forEachFusible(arr, steps, (item, idx) => {
        const key = keySelector(item, idx);
        if (!secondKeysList.some(x => comparer(x, key)) && !seenKeysList.some(x => comparer(x, key))) {
          seenKeysList.push(key);
          results.push(item);
        }
      });
    }
    return results;
  }
  return arr;
}

export function canUseArraySegmentRunner<T>(ops: PipelineOp<T>[]): boolean {
  for (let i = 0; i < ops.length; i++) {
    const kind = ops[i]!.kind;
    if (
      kind !== 'where' &&
      kind !== 'select' &&
      kind !== 'take' &&
      kind !== 'skip' &&
      kind !== 'orderBy' &&
      kind !== 'reverse' &&
      kind !== 'distinct' &&
      kind !== 'distinctBy' &&
      kind !== 'groupBy' &&
      kind !== 'join' &&
      kind !== 'leftJoin' &&
      kind !== 'rightJoin' &&
      kind !== 'fullJoin' &&
      kind !== 'groupJoin' &&
      kind !== 'zip' &&
      kind !== 'concat' &&
      kind !== 'union' &&
      kind !== 'intersect' &&
      kind !== 'except' &&
      kind !== 'unionBy' &&
      kind !== 'intersectBy' &&
      kind !== 'exceptBy'
    ) {
      return false;
    }
  }
  return true;
}

export function executeArraySegmentRunner<T>(source: T[], ops: PipelineOp<any>[]): any[] {
  let current: any[] = source;
  let i = 0;
  const len = ops.length;
  while (i < len) {
    const lazyOps: PipelineOp<any>[] = [];
    while (i < len && isLazyFusableOp(ops[i]!)) {
      lazyOps.push(ops[i]!);
      i++;
    }
    
    if (i === len) {
      if (lazyOps.length > 0) {
        current = executePipelineToArrayFast(current, lazyOps);
      }
      break;
    }
    
    const op = ops[i]!;
    if (op.kind === 'orderBy' && i + 1 < len && ops[i + 1]!.kind === 'take') {
      const takeOp = ops[i + 1] as { kind: 'take'; count: number };
      const collected: any[] = [];
      const steps = parseFusibleSteps(lazyOps);
      forEachFusible(current, steps, (item) => {
        collected.push(item);
      });
      current = executeOrderByTake(collected, op, takeOp.count);
      i += 2;
    } else {
      current = executeMaterializingOpWithLazy(current, lazyOps, op);
      i++;
    }
  }
  return current;
}

export function wrapLazy<T>(source: Iterable<T>, op: PipelineOp<T>): Iterable<T> {
  const feature = FeatureRegistry.get(op.kind);
  if (feature && feature.executeSync) {
    return feature.executeSync(source, op) as Iterable<T>;
  }
  return source;
}

export function materialize<T>(source: Iterable<T>, op: PipelineOp<T>): Iterable<T> {
  const feature = FeatureRegistry.get(op.kind);
  if (feature && feature.executeSync) {
    return feature.executeSync(source, op) as Iterable<T>;
  }
  return source;
}
