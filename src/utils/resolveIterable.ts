export async function resolveIterable<T>(
  source: Iterable<T> | AsyncIterable<T>,
): Promise<Iterable<T>> {
  if (source != null && typeof (source as AsyncIterable<T>)[Symbol.asyncIterator] === 'function') {
    const items: T[] = [];
    for await (const item of source as AsyncIterable<T>) {
      items.push(item);
    }
    return items;
  }
  return source as Iterable<T>;
}
