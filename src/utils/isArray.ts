export function isArray<T>(value: Iterable<T>): value is T[] {
  return Array.isArray(value);
}
