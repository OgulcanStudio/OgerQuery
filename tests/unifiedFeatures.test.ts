import { describe, it, expect } from 'vitest';
import { Q, QAsync, Query, AsyncQuery } from '../src/index.js';
import { FeatureRegistry } from '../src/core/FeaturePlugin.js';
import { allFeatures } from '../src/features/registry.js';
import { Grouping, Lookup } from '../src/core/types.js';

// Import registry to ensure features are registered
import '../src/features/registry.js';

function normalizeResult(val: any): any {
  if (val === null || val === undefined) return val;

  // Grouping
  if (val instanceof Grouping) {
    return {
      key: val.key,
      elements: [...val].map(normalizeResult),
    };
  }

  // Lookup
  if (val instanceof Lookup) {
    return [...val].map((g) => normalizeResult(g));
  }

  if (Array.isArray(val)) {
    return val.map(normalizeResult);
  }

  return val;
}

function convertToAsyncIterable<T>(source: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of source) {
        yield item;
      }
    },
  };
}

describe('Unified Feature Tests', () => {
  for (const feature of allFeatures) {
    describe(`${feature.name} Operator`, () => {
      for (const tc of feature.testCases) {
        it(tc.name, async () => {
          // --- Sync Execution ---
          const runSync = () => {
            let query: any = Q(tc.source);
            for (const op of tc.ops) {
              query = query[op.name](...op.args);
            }
            if (query instanceof Query) {
              return query.ToArray();
            }
            return query;
          };

          if (tc.error) {
            expect(runSync).toThrow(tc.error);
          } else {
            expect(normalizeResult(runSync())).toEqual(normalizeResult(tc.expected));
          }

          // --- Async Execution ---
          const runAsync = async () => {
            const asyncSrc = convertToAsyncIterable(tc.source);
            let query: any = QAsync(asyncSrc);
            for (let i = 0; i < tc.ops.length; i++) {
              const op = tc.ops[i]!;
              let methodName = op.name;
              if (i === tc.ops.length - 1) {
                // If it is the last op and a terminal, call the Async variant
                const regFeature = FeatureRegistry.get(op.name);
                if (regFeature && regFeature.category === 'terminal') {
                  methodName = op.name + 'Async';
                }
              }
              const result = query[methodName](...op.args);
              // if it's a promise (terminal return), await it. Otherwise chain it.
              if (result instanceof Promise) {
                query = await result;
              } else {
                query = result;
              }
            }
            if (query instanceof AsyncQuery) {
              return await query.ToArrayAsync();
            }
            return query;
          };

          if (tc.error) {
            await expect(runAsync()).rejects.toThrow(tc.error);
          } else {
            const res = await runAsync();
            expect(normalizeResult(res)).toEqual(normalizeResult(tc.expected));
          }
        });
      }
    });
  }
});
