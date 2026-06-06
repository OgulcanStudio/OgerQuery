import { AsyncQuery } from './AsyncQuery.js';
import { Query } from './Query.js';

/** Any sync sequence: arrays, readonly arrays, Sets, generators, etc. */
export type QuerySource<T> = Iterable<T> | readonly T[];

/** Any async sequence: async generators, ReadableStream adapters, etc. */
export type AsyncQuerySource<T> = AsyncIterable<T>;

export function Q<T>(source: QuerySource<T>): Query<T> {
  return new Query(source);
}

/** Fluent composition: `pipe(items, (q) => q.Where(...).ToArray())`. */
export function pipe<T, R>(source: Iterable<T>, transform: (query: Query<T>) => R): R {
  return transform(new Query(source));
}

/** Readable alias for `Q(source)`. */
export function From<T>(source: QuerySource<T>): Query<T> {
  return Q(source);
}

export function QAsync<T>(source: AsyncQuerySource<T>): AsyncQuery<T> {
  return new AsyncQuery(source);
}

/** Readable alias for `QAsync(source)`. */
export function FromAsync<T>(source: AsyncQuerySource<T>): AsyncQuery<T> {
  return QAsync(source);
}

/** Fluent composition for async sequences. */
export function pipeAsync<T, R>(
  source: AsyncQuerySource<T>,
  transform: (query: AsyncQuery<T>) => R,
): R {
  return transform(new AsyncQuery(source));
}

export function EmptyAsync<T>(): AsyncQuery<T> {
  return QAsync<T>({
    async *[Symbol.asyncIterator]() {},
  });
}

export function Empty<T>(): Query<T> {
  return Q<T>([]);
}

export function Range(start: number, count: number): Query<number> {
  if (count < 0) throw new RangeError('count must be non-negative');
  return Q(
    (function* () {
      for (let i = 0; i < count; i++) {
        yield start + i;
      }
    })(),
  );
}

export function Repeat<T>(element: T, count: number): Query<T> {
  if (count < 0) throw new RangeError('count must be non-negative');
  return Q(
    (function* () {
      for (let i = 0; i < count; i++) {
        yield element;
      }
    })(),
  );
}

Q.Empty = Empty;
Q.Range = Range;
Q.Repeat = Repeat;
Q.From = From;
Q.pipe = pipe;

QAsync.From = FromAsync;
QAsync.Empty = EmptyAsync;
QAsync.pipe = pipeAsync;
