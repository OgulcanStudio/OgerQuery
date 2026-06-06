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

export const modeFeature: FeaturePlugin = {
  name: 'Mode',
  category: 'terminal',
  runSync(source, pipeline, keySelector?: Selector<any, any>) {
    const counts = new Map<any, { value: any; count: number }>();
    let index = 0;
    for (const item of iterate(source, pipeline)) {
      const key = keySelector ? keySelector(item, index) : item;
      const entry = counts.get(key);
      if (entry) entry.count++;
      else counts.set(key, { value: key, count: 1 });
      index++;
    }
    if (counts.size === 0) throw new EmptySequenceError();
    let best = counts.values().next().value!;
    for (const entry of counts.values()) {
      if (entry.count > best.count) best = entry;
    }
    return best.value;
  },
  async runAsync(source, pipeline, keySelector?: Selector<any, any>) {
    const items = await collectToArray(source, pipeline);
    return modeFeature.runSync!(items, emptyPipeline, keySelector);
  },
  testCases: [
    {
      name: 'finds most common element',
      source: ['a', 'b', 'a'],
      ops: [{ name: 'Mode', args: [] }],
      expected: 'a',
    },
    {
      name: 'finds most common element with keySelector',
      source: [{ val: 'a' }, { val: 'b' }, { val: 'a' }],
      ops: [{ name: 'Mode', args: [(x: any) => x.val] }],
      expected: 'a',
    },
  ],
};
