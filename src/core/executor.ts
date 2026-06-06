import { isArray } from '../utils/isArray.js';
import type { OpPipeline } from './OpPipeline.js';
import { canUseArrayFastPath, type PipelineOp } from './pipelineOps.js';
import type { Predicate, Selector, EqualityComparer } from './types.js';
import { Grouping } from './types.js';
import { FeatureRegistry } from './FeaturePlugin.js';
import { stableSortInPlace, type OrderKeyEntry } from '../features/materializing/orderByHelpers.js';
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
  next() {
    while (this.i < this.arr.length) {
      const item = this.arr[this.i];
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
  next() {
    if (this.i < this.arr.length) {
      const val = this.s(this.arr[this.i], this.i);
      this.i++;
      return { done: false, value: val };
    }
    return { done: true, value: undefined };
  }
}

class ArrayTakeIterator<T> implements Iterator<T> {
  private i = 0;
  constructor(private arr: T[], private count: number) {}
  next() {
    if (this.i < this.count && this.i < this.arr.length) {
      return { done: false, value: this.arr[this.i++] };
    }
    return { done: true, value: undefined };
  }
}

class ArraySkipIterator<T> implements Iterator<T> {
  private i: number;
  constructor(private arr: T[], count: number) {
    this.i = Math.max(0, count);
  }
  next() {
    if (this.i < this.arr.length) {
      return { done: false, value: this.arr[this.i++] };
    }
    return { done: true, value: undefined };
  }
}

class ArrayWhereSelectIterator<T, R> implements Iterator<R> {
  private i = 0;
  constructor(private arr: T[], private p: Predicate<T>, private s: Selector<T, R>) {}
  next() {
    while (this.i < this.arr.length) {
      const item = this.arr[this.i];
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
  next() {
    if (this.taken >= this.count) return { done: true, value: undefined };
    while (this.i < this.arr.length) {
      const item = this.arr[this.i];
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
  next() {
    if (this.i < this.count && this.i < this.arr.length) {
      const val = this.s(this.arr[this.i], this.i);
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
  next() {
    if (this.taken >= this.count) return { done: true, value: undefined };
    while (this.i < this.arr.length) {
      const item = this.arr[this.i];
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
  next() {
    if (this.taken >= this.take) return { done: true, value: undefined };
    while (this.i < this.arr.length) {
      const item = this.arr[this.i];
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
      const subRes = this.currentIterator.next();
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
      return new UnionPullStep(source, op.second, op.comparer);
    case 'intersect':
      return new IntersectPullStep(source, op.second, op.comparer);
    case 'except':
      return new ExceptPullStep(source, op.second, op.comparer);
    case 'unionBy':
      return new UnionByPullStep(source, op.second, op.keySelector, op.comparer);
    case 'intersectBy':
      return new IntersectByPullStep(source, op.second, op.keySelector, op.comparer);
    case 'exceptBy':
      return new ExceptByPullStep(source, op.second, op.keySelector, op.comparer);
    case 'aggregateBy':
      return new AggregateByPullStep(source, op.keySelector, op.seed, op.func, op.comparer);
    case 'zip':
      return new ZipPullStep(source, op.second, op.resultSelector);
    case 'concat':
      return new ConcatPullStep(source, op.second);
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
  if (isArray(source) && canUseArrayFastPath(ops)) {
    return executePipelineToArrayFast(source, ops);
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
  ops: PipelineOp<any>[],
  predicate?: Predicate<T>
): number {
  const activeOps = predicate
    ? [...ops, { kind: 'where' as const, predicate }]
    : ops;

  const steps: {
    kind: 'where' | 'select' | 'take' | 'skip';
    fn?: Function;
    val?: number;
    skipped?: number;
    taken?: number;
  }[] = [];

  for (const op of activeOps) {
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
  let count = 0;
  let index = 0;

  // Single-op optimization
  if (stepsLen === 1 && steps[0]!.kind === 'where') {
    const p = steps[0]!.fn!;
    for (let i = 0; i < source.length; i++) {
      if (p(source[i]!, i)) count++;
    }
    return count;
  }

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
    count++;

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
  if (isArray(source) && canUseArrayFastPath(activeOps)) {
    return executePipelineToCountFast(source, ops, predicate);
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
  const steps = parseFusibleSteps(ops);
  const acc = { sum: 0, compensation: 0 };
  forEachFusible(source, steps, (item, index) => {
    const value = selector ? selector(item as T, index) : (item as number);
    kahanAdd(acc, value);
  });
  return kahanTotal(acc);
}

export function executePipelineToSum<T>(
  source: Iterable<T>,
  ops: PipelineOp<any>[],
  selector?: Selector<T, number>,
): number {
  if (isArray(source) && canUseArrayFastPath(ops)) {
    return executePipelineToSumFast(source, ops, selector);
  }
  const acc = { sum: 0, compensation: 0 };
  let index = 0;
  for (const item of executePipeline(source, { ops } as OpPipeline<T>)) {
    const value = selector ? selector(item, index) : (item as number);
    kahanAdd(acc, value);
    index++;
  }
  return kahanTotal(acc);
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
