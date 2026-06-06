import { describe, it, expect } from 'vitest';
import {
  some,
  None,
  fromNullable,
  ok,
  err,
  tryRun,
  tryRunSync,
} from '../src/result/option.js';
import {
  fromReadableStream,
  toReadableStream,
} from '../src/streams/adapters.js';
import {
  validateFilterWithSchema,
  assertFilterShape,
} from '../src/schema/schemaFilter.js';
import {
  explainPipeline,
  explainPipelineText,
  setDebugMode,
  isDebugMode,
  debugLog,
} from '../src/debug/explain.js';
import {
  parseQueryString,
  parseFilterJson,
  predicateFromParsedQuery,
  safeApiError,
} from '../src/api/parseQuery.js';
import {
  assertAllowedField,
  clampLimit,
  parsePositiveInt,
  assertMaxDepth,
  sanitizeFilterObject,
} from '../src/api/security.js';
import {
  and,
  or,
  not,
  buildPredicate,
  fieldPredicate,
  pathPredicate,
  getPathValue,
} from '../src/filter/filterBuilder.js';
import {
  createPageResult,
  clampPageSize,
} from '../src/pagination/types.js';
import * as predicates from '../src/helpers/predicates.js';
import { OpPipeline } from '../src/core/OpPipeline.js';

describe('Option & Result Helpers', () => {
  it('Some, None, fromNullable', () => {
    expect(some(5)).toEqual({ ok: true, value: 5 });
    expect(None).toEqual({ ok: false });
    expect(fromNullable(null)).toEqual(None);
    expect(fromNullable(undefined)).toEqual(None);
    expect(fromNullable(5)).toEqual(some(5));
  });

  it('ok, err, tryRun, tryRunSync', async () => {
    expect(ok(5)).toEqual({ ok: true, value: 5 });
    expect(err('error')).toEqual({ ok: false, error: 'error' });

    expect(tryRunSync(() => 5)).toEqual(ok(5));
    expect(tryRunSync(() => { throw new Error('boom'); })).toEqual(err(new Error('boom')));
    expect(tryRunSync(() => { throw 'string error'; })).toEqual(err(new Error('string error')));

    await expect(tryRun(async () => 5)).resolves.toEqual(ok(5));
    await expect(tryRun(async () => { throw new Error('boom'); })).resolves.toEqual(err(new Error('boom')));
    await expect(tryRun(async () => { throw 'string error'; })).resolves.toEqual(err(new Error('string error')));
  });
});

describe('Streams Adapters', () => {
  it('converts to and from ReadableStream', async () => {
    const data = [1, 2, 3];
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        for (const item of data) yield item;
      },
    };
    const stream = toReadableStream(asyncIterable);
    expect(stream).toBeInstanceOf(ReadableStream);

    const convertedIterable = fromReadableStream(stream);
    const result: number[] = [];
    for await (const val of convertedIterable) {
      result.push(val);
    }
    expect(result).toEqual(data);
  });
});

describe('Schema Filter shape check', () => {
  it('asserts safe shape', () => {
    const goodFilter = { and: [{ field: 'id', op: 'eq', value: 1 }] };
    expect(assertFilterShape(goodFilter as any)).toEqual(goodFilter);

    const badFilter = { and: [{ field: 'constructor.prototype.foo', op: 'eq', value: 1 }] };
    expect(() => assertFilterShape(badFilter as any)).toThrow('Unsafe filter field');

    const fakeSchema = {
      safeParse: (input: any) => {
        if (input.valid) return { success: true, data: { and: [] } };
        return { success: false, error: 'invalid' };
      },
    };
    expect(validateFilterWithSchema(fakeSchema as any, { valid: true })).toEqual({ and: [] });
    expect(() => validateFilterWithSchema(fakeSchema as any, { valid: false })).toThrow('Invalid filter schema');
  });
});

describe('Debug / Explain helpers', () => {
  it('explains pipelines', () => {
    let p = new OpPipeline<any>();
    p = p.append({ kind: 'take', count: 5 });
    p = p.append({ kind: 'skip', count: 2 });
    p = p.append({ kind: 'orderBy', keys: [{ key: (x) => x, descending: false }] });
    p = p.append({ kind: 'where', predicate: () => true });

    const explain = explainPipeline(p);
    expect(explain[0]).toEqual({ index: 0, kind: 'take', detail: 'count=5' });
    expect(explain[1]).toEqual({ index: 1, kind: 'skip', detail: 'count=2' });
    expect(explain[2]).toEqual({ index: 2, kind: 'orderBy', detail: 'keys=1' });
    expect(explain[3]).toEqual({ index: 3, kind: 'where', detail: undefined });

    const text = explainPipelineText(p);
    expect(text[0]).toBe('0: take (count=5)');
    expect(text[3]).toBe('3: where');
  });

  it('debug mode', () => {
    setDebugMode(false);
    expect(isDebugMode()).toBe(false);
    debugLog('test'); // should not print

    setDebugMode(true);
    expect(isDebugMode()).toBe(true);
    debugLog('test message %s', 'hello'); // prints
  });
});

describe('API Parser & Security', () => {
  it('parseQueryString', () => {
    const q1 = parseQueryString('?page=2&pageSize=10&limit=5&sort=name&filter={"field":"age","op":"gt","value":30}');
    expect(q1.page).toBe(2);
    expect(q1.pageSize).toBe(10);
    expect(q1.limit).toBe(5);
    expect(q1.sort).toBe('name');
    expect(q1.filter).toEqual({ and: [{ field: 'age', op: 'gt', value: 30 }] });

    const q2 = parseQueryString('?page=abc&pageSize=-1&limit=abc');
    expect(q2.page).toBeUndefined();
    expect(q2.pageSize).toBeUndefined();

    const q3 = parseQueryString('?filter={"and":[{"field":"name","op":"eq","value":"Josh"}]}');
    expect(q3.filter?.and?.[0]).toEqual({ field: 'name', op: 'eq', value: 'Josh' });

    const q4 = parseQueryString('?filter={"or":[{"field":"name","op":"eq","value":"Josh"}]}');
    expect(q4.filter?.or?.[0]).toEqual({ field: 'name', op: 'eq', value: 'Josh' });

    const q5 = parseQueryString('?filter={"not":{"field":"name","op":"eq","value":"Josh"}}');
    expect(q5.filter?.not).toEqual({ field: 'name', op: 'eq', value: 'Josh' });

    const q6 = parseQueryString('?filter={"nested":{"and":[]}}');
    expect(q6.filter).toEqual({ and: [] });

    const qNoQuestion = parseQueryString('page=2&pageSize=10');
    expect(qNoQuestion.page).toBe(2);
    expect(qNoQuestion.pageSize).toBe(10);

    const q7 = parseQueryString('?filter={"not":{"and":[{"field":"name","op":"eq","value":"Josh"}]}}');
    expect(q7.filter?.not).toEqual({ and: [{ field: 'name', op: 'eq', value: 'Josh' }] });
  });

  it('clampLimit', () => {
    expect(clampLimit(50)).toBe(50);
    expect(clampLimit(-10)).toBe(1);
    expect(clampLimit(Infinity)).toBe(1);
  });

  it('assertMaxDepth', () => {
    expect(() => assertMaxDepth(10, 5)).toThrow('Filter depth exceeds maximum');
  });

  it('assertAllowedField', () => {
    expect(() => assertAllowedField('role', ['name'])).toThrow('Field is not allowed');
    expect(() => assertAllowedField('constructor')).toThrow('Invalid field name');
  });

  it('sanitizeFilterObject', () => {
    const raw = {
      field: 'name',
      op: 'eq',
      constructor: {},
      nested: {
        field: 'age',
      },
    };
    const clean = sanitizeFilterObject(raw);
    expect(clean.field).toBe('name');
    expect((clean as any).constructor).toBeUndefined();
    expect((clean.nested as any).field).toBe('age');
  });

  it('safeApiError', () => {
    expect(safeApiError(new Error('my error'))).toBe('my error');
    expect(safeApiError('bad')).toBe('Request failed');
  });

  it('predicateFromParsedQuery', () => {
    const q = parseQueryString('?filter={"field":"id","op":"eq","value":1}');
    const pred = predicateFromParsedQuery<{ id: number }>(q);
    expect(pred).toBeDefined();
    expect(pred!({ id: 1 })).toBe(true);
    expect(pred!({ id: 2 })).toBe(false);

    expect(predicateFromParsedQuery({})).toBeUndefined();
  });
});

describe('Filter Builder & Predicates', () => {
  it('combines predicates (and, or, not)', () => {
    const p1 = (x: number) => x > 1;
    const p2 = (x: number) => x < 5;
    expect(and(p1, p2)(3)).toBe(true);
    expect(and(p1, p2)(6)).toBe(false);
    expect(or(p1, p2)(6)).toBe(true);
    expect(not(p1)(1)).toBe(true);
  });

  it('predicateFromClause and buildPredicate operators', () => {
    expect(fieldPredicate('val', 'ne', 5)({ val: 6 })).toBe(true);
    expect(fieldPredicate('val', 'gt', 5)({ val: 6 })).toBe(true);
    expect(fieldPredicate('val', 'gte', 5)({ val: 5 })).toBe(true);
    expect(fieldPredicate('val', 'lt', 5)({ val: 4 })).toBe(true);
    expect(fieldPredicate('val', 'lte', 5)({ val: 5 })).toBe(true);
    
    // Test 'in' and 'nin' with undefined values
    expect(fieldPredicate('val', 'in', undefined)({ val: 1 })).toBe(false);
    expect(fieldPredicate('val', 'nin', undefined)({ val: 3 })).toBe(true);
    expect(fieldPredicate('val', 'in', [1, 2])({ val: 1 })).toBe(true);
    expect(fieldPredicate('val', 'nin', [1, 2])({ val: 3 })).toBe(true);
    
    expect(fieldPredicate('val', 'between', 1, { value2: 3 })({ val: 2 })).toBe(true);
    
    // Test 'contains', 'startsWith', 'endsWith' with insensitive and undefined value
    expect(fieldPredicate('val', 'contains', 'BC', { insensitive: true })({ val: 'abcd' })).toBe(true);
    expect(fieldPredicate('val', 'contains', undefined)({ val: 'abcd' })).toBe(true);
    expect(fieldPredicate('val', 'startsWith', 'AB', { insensitive: true })({ val: 'abcd' })).toBe(true);
    expect(fieldPredicate('val', 'startsWith', undefined)({ val: 'abcd' })).toBe(true);
    expect(fieldPredicate('val', 'endsWith', 'CD', { insensitive: true })({ val: 'abcd' })).toBe(true);
    expect(fieldPredicate('val', 'endsWith', undefined)({ val: 'abcd' })).toBe(true);
    
    expect(fieldPredicate('val', 'contains', 'bc')({ val: 'abcd' })).toBe(true);
    expect(fieldPredicate('val', 'startsWith', 'ab')({ val: 'abcd' })).toBe(true);
    expect(fieldPredicate('val', 'endsWith', 'cd')({ val: 'abcd' })).toBe(true);
    expect(fieldPredicate('val', 'null')({ val: null })).toBe(true);
    expect(fieldPredicate('val', 'notNull')({ val: 1 })).toBe(true);

    expect(() => fieldPredicate('val', 'unknown_op' as any)({ val: 1 })).toThrow('Unknown filter operator');
    expect(() => fieldPredicate('__proto__', 'eq')({ val: 1 })).toThrow('Unsafe filter field');

    const groupNot = { not: { field: 'val', op: 'eq', value: 1 } };
    expect(buildPredicate(groupNot)({ val: 1 })).toBe(false);
    expect(buildPredicate(groupNot)({ val: 2 })).toBe(true);

    const groupNotNested = { not: { and: [{ field: 'val', op: 'eq', value: 1 }] } };
    expect(buildPredicate(groupNotNested)({ val: 1 })).toBe(false);

    // Test nested and group
    const groupAndNested = {
      and: [
        { and: [{ field: 'val', op: 'eq', value: 1 }] }
      ]
    };
    expect(buildPredicate(groupAndNested)({ val: 1 })).toBe(true);
    expect(buildPredicate(groupAndNested)({ val: 2 })).toBe(false);

    const groupEmpty = {};
    expect(buildPredicate(groupEmpty)({})).toBe(true);

    expect(pathPredicate('val', 'eq', 1)({ val: 1 })).toBe(true);
    expect(getPathValue({ profile: { age: 30 } }, 'profile.age')).toBe(30);
  });

  it('helper predicates direct calls', () => {
    expect(predicates.whereEq('profile.age', 30)({ profile: { age: 30 } })).toBe(true);
    expect(predicates.whereEq('age', 30)({ age: 30 })).toBe(true);
    expect(predicates.pluck('age')({ age: 30 })).toBe(30);
    expect(predicates.selectKeys(['a'])({ a: 1, b: 2 })).toEqual({ a: 1 });
    expect(predicates.omitKeys(['a'])({ a: 1, b: 2 })).toEqual({ b: 2 });

    expect(predicates.whereGt('val', 5)({ val: null })).toBe(false);
    expect(predicates.whereGte('val', 5)({ val: null })).toBe(false);
    expect(predicates.whereLt('val', 5)({ val: null })).toBe(false);
    expect(predicates.whereLte('val', 5)({ val: null })).toBe(false);
    expect(predicates.whereBetween('val', 1, 5)({ val: null })).toBe(false);

    expect(predicates.whereContains('val', 'bc', true)({ val: 'ABCD' })).toBe(true);
    expect(predicates.whereContains('val', 'bc', false)({ val: 'ABCD' })).toBe(false);
    expect(predicates.whereContains('val', 'bc')({ val: 123 as any })).toBe(false);

    expect(predicates.whereStartsWith('val', 'ab', true)({ val: 'ABCD' })).toBe(true);
    expect(predicates.whereStartsWith('val', 'ab', false)({ val: 'ABCD' })).toBe(false);
    expect(predicates.whereStartsWith('val', 'ab')({ val: 123 as any })).toBe(false);

    expect(predicates.whereEndsWith('val', 'cd', true)({ val: 'ABCD' })).toBe(true);
    expect(predicates.whereEndsWith('val', 'cd', false)({ val: 'ABCD' })).toBe(false);
    expect(predicates.whereEndsWith('val', 'cd')({ val: 123 as any })).toBe(false);

    expect(predicates.whereTruthy('val')({ val: 1 })).toBe(true);
    expect(predicates.whereFalsy('val')({ val: 0 })).toBe(true);
  });

  it('additional filter builder and shape checks', () => {
    // assertFilterShape with or and not groups (schema/schemaFilter.ts)
    expect(assertFilterShape({ or: [{ field: 'id', op: 'eq', value: 1 }] })).toBeDefined();
    expect(assertFilterShape({ not: { field: 'id', op: 'eq', value: 1 } })).toBeDefined();

    // buildPredicate with or groups (filter/filterBuilder.ts)
    const groupOr = {
      or: [
        { field: 'val', op: 'eq', value: 1 },
        { and: [{ field: 'val', op: 'eq', value: 2 }] }
      ]
    };
    const predOr = buildPredicate(groupOr);
    expect(predOr({ val: 1 })).toBe(true);
    expect(predOr({ val: 2 })).toBe(true);
    expect(predOr({ val: 3 })).toBe(false);
  });

  it('toReadableStream cancellation support', async () => {
    let returnCalled = false;
    const mockAsyncIterable = {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            return { done: false, value: 1 };
          },
          async return() {
            returnCalled = true;
            return { done: true, value: undefined };
          }
        };
      }
    };
    const stream = toReadableStream(mockAsyncIterable);
    await stream.cancel();
    expect(returnCalled).toBe(true);
  });

  it('pagination types and helpers', () => {
    // createPageResult (pagination/types.ts)
    const page1 = createPageResult([1, 2], 1, 10, 2);
    expect(page1.totalPages).toBe(1);
    expect(page1.hasNext).toBe(false);
    expect(page1.hasPrevious).toBe(false);

    const page2 = createPageResult([1, 2], 1, 0, 2);
    expect(page2.totalPages).toBe(0);

    // clampPageSize (pagination/types.ts)
    expect(clampPageSize(0)).toBe(1);
    expect(clampPageSize(50)).toBe(50);
    expect(clampPageSize(2000, 1000)).toBe(1000);
  });
});
