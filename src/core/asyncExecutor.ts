import { isArray } from '../utils/isArray.js';
import { resolveMaterializingOpSecond } from '../utils/resolveMaterializingOp.js';
import { executePipeline, materialize, wrapLazy, executeOrderByTake } from './executor.js';
import type { OpPipeline } from './OpPipeline.js';
import { canUseArrayFastPath, isMaterializingOpAt, type PipelineOp } from './pipelineOps.js';

const isMaterializingInSlice = isMaterializingOpAt;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

async function* collectAsync<T>(source: AsyncIterable<T>, signal?: AbortSignal): AsyncGenerator<T> {
  for await (const item of source) {
    throwIfAborted(signal);
    yield item;
  }
}

async function* arrayFastPathAsync<T>(
  source: T[],
  ops: PipelineOp<T>[],
  signal?: AbortSignal,
): AsyncGenerator<T> {
  for (const item of executePipeline(source, { ops } as OpPipeline<T>)) {
    throwIfAborted(signal);
    yield item;
  }
}

export async function* executeAsyncPipeline<T>(
  source: AsyncIterable<T>,
  pipeline: OpPipeline<T>,
  signal?: AbortSignal,
): AsyncGenerator<T> {
  throwIfAborted(signal);
  const ops = pipeline.ops;
  if (ops.length === 0) {
    yield* collectAsync(source, signal);
    return;
  }
  if (isArray(source as unknown as Iterable<T>) && canUseArrayFastPath(ops)) {
    yield* arrayFastPathAsync(source as unknown as T[], ops, signal);
    return;
  }

  let i = 0;
  let current: AsyncIterable<T> = source;
  while (i < ops.length) {
    const lazyBatch: PipelineOp<T>[] = [];
    while (i < ops.length && !isMaterializingInSlice(ops, i)) {
      lazyBatch.push(ops[i]!);
      i++;
    }
    if (lazyBatch.length > 0) {
      current = applyAsyncLazyBatch(current, lazyBatch, signal);
    }
    if (i < ops.length) {
      const op = await resolveMaterializingOpSecond(ops[i]!);
      if (op.kind === 'orderBy' && i + 1 < ops.length && ops[i + 1]!.kind === 'take') {
        const takeOp = ops[i + 1] as { kind: 'take'; count: number };
        const collected = await collectToArray(current, signal);
        const optimized = executeOrderByTake(collected, op, takeOp.count);
        current = asyncFromIterable(optimized);
        i += 2;
      } else {
        const materialized = materialize(await collectToArray(current, signal), op);
        current = asyncFromIterable(materialized);
        i++;
      }
    }
  }
  yield* collectAsync(current, signal);
}

async function collectToArray<T>(source: AsyncIterable<T>, signal?: AbortSignal): Promise<T[]> {
  const result: T[] = [];
  for await (const item of collectAsync(source, signal)) {
    result.push(item);
  }
  return result;
}

function asyncFromIterable<T>(source: Iterable<T>): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      yield* source;
    },
  };
}

function applyAsyncLazyBatch<T>(
  source: AsyncIterable<T>,
  ops: PipelineOp<T>[],
  signal?: AbortSignal,
): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      const supportedKinds = new Set(['where', 'select', 'take', 'skip', 'tap', 'cast', 'ofType']);
      const canUseFastPath = ops.every((op) => supportedKinds.has(op.kind));

      if (!canUseFastPath) {
        yield* executePipeline(await collectToArray(source, signal), {
          ops,
        } as OpPipeline<T>);
        return;
      }

      const steps: {
        kind: string;
        fn?: Function;
        val?: number;
        state?: any;
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
            steps.push({ kind: 'take', val: (op as any).count, state: { taken: 0 } });
            break;
          case 'skip':
            steps.push({ kind: 'skip', val: (op as any).count, state: { skipped: 0 } });
            break;
          case 'tap':
            steps.push({ kind: 'tap', fn: (op as any).action });
            break;
          case 'cast':
            steps.push({ kind: 'cast' });
            break;
          case 'ofType':
            steps.push({ kind: 'ofType' });
            break;
        }
      }

      if (steps.some((s) => s.kind === 'take' && s.val! <= 0)) {
        return;
      }

      let index = 0;
      outer: for await (const item of source) {
        throwIfAborted(signal);
        let current: any = item;
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i]!;
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
              if (step.state.skipped < step.val!) {
                step.state.skipped++;
                index++;
                continue outer;
              }
              break;
            case 'take':
              if (step.state.taken >= step.val!) {
                return;
              }
              step.state.taken++;
              break;
            case 'tap':
              step.fn!(current, index);
              break;
            case 'ofType':
              if (current === null || current === undefined || typeof current !== 'object') {
                index++;
                continue outer;
              }
              break;
          }
        }
        yield current;

        // Check if all takes are done to exit early
        let allTakesDone = true;
        let hasTake = false;
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i]!;
          if (step.kind === 'take') {
            hasTake = true;
            if (step.state.taken < step.val!) {
              allTakesDone = false;
              break;
            }
          }
        }
        if (hasTake && allTakesDone) {
          return;
        }

        index++;
      }
    },
  };
}
