export type Predicate<T> = (item: T, index?: number) => boolean;
export type Selector<T, R> = (item: T, index?: number) => R;

/** Element paired with its 0-based index in the current pipeline output. */
export type Indexed<T> = { readonly value: T; readonly index: number };

/** Consecutive pair emitted by `Pairwise()`. */
export type Pair<T> = readonly [previous: T, current: T];
export type Comparer<T> = (a: T, b: T) => number;
export type EqualityComparer<T> = (a: T, b: T) => boolean;
export type OrderKey<T, K> = (item: T, index?: number) => K;

export interface IGrouping<K, T> {
  readonly key: K;
  readonly [Symbol.iterator]: () => Iterator<T>;
}

export class Grouping<K, T> implements IGrouping<K, T> {
  constructor(
    readonly key: K,
    private readonly elements: T[],
  ) {}

  [Symbol.iterator](): Iterator<T> {
    return this.elements[Symbol.iterator]();
  }

  toArray(): T[] {
    return this.elements;
  }
}

export class Lookup<K, T> implements Iterable<IGrouping<K, T>> {
  private readonly groups: Map<K, T[]>;

  constructor(entries: Iterable<[K, T[]]>) {
    this.groups = new Map(entries);
  }

  *[Symbol.iterator](): Iterator<IGrouping<K, T>> {
    for (const [key, elements] of this.groups) {
      yield new Grouping(key, elements);
    }
  }

  get(key: K): IGrouping<K, T> {
    return new Grouping(key, this.groups.get(key) ?? []);
  }

  contains(key: K): boolean {
    return this.groups.has(key);
  }

  count(): number {
    return this.groups.size;
  }
}

export class EmptySequenceError extends Error {
  constructor(message = 'Sequence contains no elements') {
    super(message);
    this.name = 'EmptySequenceError';
  }
}

export class MoreThanOneElementError extends Error {
  constructor(message = 'Sequence contains more than one element') {
    super(message);
    this.name = 'MoreThanOneElementError';
  }
}

export class ArgumentOutOfRangeError extends Error {
  constructor(message = 'Index was out of range') {
    super(message);
    this.name = 'ArgumentOutOfRangeError';
  }
}

export class InvalidOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOperationError';
  }
}
