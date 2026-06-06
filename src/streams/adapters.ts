export function fromReadableStream<T>(stream: ReadableStream<T>): AsyncIterable<T> {
  const reader = stream.getReader();
  return {
    async *[Symbol.asyncIterator]() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) return;
          yield value;
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}

export function toReadableStream<T>(source: AsyncIterable<T>): ReadableStream<T> {
  const iterator = source[Symbol.asyncIterator]();
  return new ReadableStream<T>({
    async pull(controller) {
      const { done, value } = await iterator.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}
