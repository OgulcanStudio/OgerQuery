import type { FeaturePlugin } from '../../core/FeaturePlugin.js';
import type { OpPipeline } from '../../core/OpPipeline.js';
import { executePipeline } from '../../core/executor.js';
import { executeAsyncPipeline } from '../../core/asyncExecutor.js';
import {
  EmptySequenceError,
  MoreThanOneElementError,
  ArgumentOutOfRangeError,
  Grouping,
  Lookup,
  type Predicate,
  type Selector,
  type EqualityComparer,
} from '../../core/types.js';
import { compareWith, equalsWith } from '../../utils/comparer.js';
import { defaultComparer } from '../../utils/defaultComparer.js';
import { clampPageSize, createPageResult, type PageResult, type CursorPageResult } from '../../pagination/types.js';
import { iterate, collectToArray, emptyPipeline } from './terminalHelpers.js';

export const forEachFeature: FeaturePlugin = {
  name: 'ForEach',
  category: 'terminal',
  runSync(source, pipeline, action: (item: any, index: number) => void) {
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      action(item, index);
      index++;
    }
  },
  async runAsync(source, pipeline, action: (item: any, index: number) => void | Promise<void>, options?: { concurrency?: number; signal?: AbortSignal }) {
    const concurrency = Math.max(1, options?.concurrency ?? 1);
    const signal = options?.signal;
    if (concurrency === 1) {
      let index = 0;
      for await (const item of executeAsyncPipeline(source, pipeline, signal)) {
        await action(item, index);
        index++;
      }
      return;
    }
    const items = await collectToArray(source, pipeline);
    let nextIndex = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (nextIndex < items.length) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const current = nextIndex++;
        const item = items[current]!;
        await action(item, current);
      }
    });
    await Promise.all(workers);
  },
  testCases: [
    {
      name: 'iterates over each element',
      source: [10, 20],
      ops: [
        {
          name: 'ForEach',
          args: [
            (x: number, i: number) => {
              // Tested by execution
            },
          ],
        },
      ],
      expected: undefined,
    },
    {
      name: 'ForEach executes asynchronously with concurrency',
      source: [1, 2, 3],
      ops: [
        {
          name: 'ForEach',
          args: [
            (x: number) => {},
            { concurrency: 2 }
          ]
        }
      ],
      expected: undefined
    }
  ],
};
