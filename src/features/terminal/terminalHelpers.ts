import type { OpPipeline } from '../../core/OpPipeline.js';
import { executePipeline } from '../../core/executor.js';
import { executeAsyncPipeline } from '../../core/asyncExecutor.js';

export function iterate<T>(source: Iterable<T>, pipeline: OpPipeline<T>): Iterable<T> {
  return {
    [Symbol.iterator]() {
      return executePipeline(source, pipeline);
    },
  };
}

export async function collectToArray<T>(
  source: AsyncIterable<T>,
  pipeline: OpPipeline<T>,
): Promise<T[]> {
  const result: T[] = [];
  for await (const item of executeAsyncPipeline(source, pipeline)) {
    result.push(item);
  }
  return result;
}

export const emptyPipeline = { ops: [] } as any;
