import { describe, it, expect } from 'vitest';
import { Q, QAsync } from '../../src/index.js';

const items = [
  { id: 1, name: 'Josh', age: 30, role: 'Admin', tags: ['a', 'b'], dob: new Date(1996, 1, 1), status: null },
  { id: 2, name: 'Amy', age: 25, role: 'User', tags: ['b'], dob: new Date(2001, 1, 1), status: 'Active' },
  { id: 3, name: 'Dave', age: 40, role: 'User', tags: [], dob: new Date(1986, 1, 1), status: 'Inactive' },
];

describe('Query and AsyncQuery Helper Wrappers', () => {
  it('tests Query helper methods', () => {
    // GroupByMany
    const gbm = Q(items).GroupByMany(x => x.role, x => x.age).ToArray();
    expect(gbm.length).toBe(3);

    // Page
    expect(Q(items).Page(1, 2).ToArray().map(x => x.id)).toEqual([1, 2]);
    expect(Q(items).Page(2, 2).ToArray().map(x => x.id)).toEqual([3]);

    // WhereEq
    expect(Q(items).WhereEq('name', 'Amy').ToArray().map(x => x.id)).toEqual([2]);

    // WhereNotEq
    expect(Q(items).WhereNotEq('name', 'Amy').ToArray().map(x => x.id)).toEqual([1, 3]);

    // WhereGt
    expect(Q(items).WhereGt('age', 25).ToArray().map(x => x.id)).toEqual([1, 3]);

    // WhereGte
    expect(Q(items).WhereGte('age', 25).ToArray().map(x => x.id)).toEqual([1, 2, 3]);

    // WhereLt
    expect(Q(items).WhereLt('age', 30).ToArray().map(x => x.id)).toEqual([2]);

    // WhereLte
    expect(Q(items).WhereLte('age', 30).ToArray().map(x => x.id)).toEqual([1, 2]);

    // WhereIn
    expect(Q(items).WhereIn('name', ['Josh', 'Dave']).ToArray().map(x => x.id)).toEqual([1, 3]);

    // WhereNotIn
    expect(Q(items).WhereNotIn('name', ['Josh', 'Dave']).ToArray().map(x => x.id)).toEqual([2]);

    // WhereBetween
    expect(Q(items).WhereBetween('age', 25, 30).ToArray().map(x => x.id)).toEqual([1, 2]);

    // WhereContains
    expect(Q(items).WhereContains('name', 'am', true).ToArray().map(x => x.id)).toEqual([2]);

    // WhereStartsWith
    expect(Q(items).WhereStartsWith('name', 'Jo').ToArray().map(x => x.id)).toEqual([1]);

    // WhereEndsWith
    expect(Q(items).WhereEndsWith('name', 've').ToArray().map(x => x.id)).toEqual([3]);

    // WhereNull
    expect(Q(items).WhereNull('status').ToArray().map(x => x.id)).toEqual([1]);

    // WhereNotNull
    expect(Q(items).WhereNotNull('status').ToArray().map(x => x.id)).toEqual([2, 3]);

    // WhereTruthy
    expect(Q(items).WhereTruthy('status').ToArray().map(x => x.id)).toEqual([2, 3]);

    // WhereFalsy
    expect(Q(items).WhereFalsy('status').ToArray().map(x => x.id)).toEqual([1]);

    // Pluck
    expect(Q(items).Pluck('age').ToArray()).toEqual([30, 25, 40]);

    // SelectKeys
    expect(Q(items).SelectKeys('id', 'name').ToArray()).toEqual([
      { id: 1, name: 'Josh' },
      { id: 2, name: 'Amy' },
      { id: 3, name: 'Dave' },
    ]);

    // OmitKeys
    expect(Q(items).OmitKeys('age', 'tags', 'dob', 'status', 'role').ToArray()).toEqual([
      { id: 1, name: 'Josh' },
      { id: 2, name: 'Amy' },
      { id: 3, name: 'Dave' },
    ]);

    // Explain & ExplainText
    const q = Q(items).WhereEq('name', 'Amy');
    expect(q.Explain()).toBeDefined();
    expect(q.ExplainText()).toBeDefined();
  });

  it('tests AsyncQuery helper methods', async () => {
    const source = async () => {
      return {
        async *[Symbol.asyncIterator]() {
          for (const item of items) yield item;
        }
      };
    };

    // GroupByMany
    const gbm = await QAsync(await source()).GroupByMany(x => x.role, x => x.age).ToArrayAsync();
    expect(gbm.length).toBe(3);

    // Page
    expect(await QAsync(await source()).Page(1, 2).ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([1, 2]);
    expect(await QAsync(await source()).Page(2, 2).ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([3]);

    // WhereEq
    expect(await QAsync(await source()).WhereEq('name', 'Amy').ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([2]);

    // WhereNotEq
    expect(await QAsync(await source()).WhereNotEq('name', 'Amy').ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([1, 3]);

    // WhereGt
    expect(await QAsync(await source()).WhereGt('age', 25).ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([1, 3]);

    // WhereGte
    expect(await QAsync(await source()).WhereGte('age', 25).ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([1, 2, 3]);

    // WhereLt
    expect(await QAsync(await source()).WhereLt('age', 30).ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([2]);

    // WhereLte
    expect(await QAsync(await source()).WhereLte('age', 30).ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([1, 2]);

    // WhereIn
    expect(await QAsync(await source()).WhereIn('name', ['Josh', 'Dave']).ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([1, 3]);

    // WhereNotIn
    expect(await QAsync(await source()).WhereNotIn('name', ['Josh', 'Dave']).ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([2]);

    // WhereBetween
    expect(await QAsync(await source()).WhereBetween('age', 25, 30).ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([1, 2]);

    // WhereContains
    expect(await QAsync(await source()).WhereContains('name', 'am', true).ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([2]);

    // WhereStartsWith
    expect(await QAsync(await source()).WhereStartsWith('name', 'Jo').ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([1]);

    // WhereEndsWith
    expect(await QAsync(await source()).WhereEndsWith('name', 've').ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([3]);

    // WhereNull
    expect(await QAsync(await source()).WhereNull('status').ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([1]);

    // WhereNotNull
    expect(await QAsync(await source()).WhereNotNull('status').ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([2, 3]);

    // WhereTruthy
    expect(await QAsync(await source()).WhereTruthy('status').ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([2, 3]);

    // WhereFalsy
    expect(await QAsync(await source()).WhereFalsy('status').ToArrayAsync().then(arr => arr.map(x => x.id))).toEqual([1]);

    // Pluck
    expect(await QAsync(await source()).Pluck('age').ToArrayAsync()).toEqual([30, 25, 40]);

    // SelectKeys
    expect(await QAsync(await source()).SelectKeys('id', 'name').ToArrayAsync()).toEqual([
      { id: 1, name: 'Josh' },
      { id: 2, name: 'Amy' },
      { id: 3, name: 'Dave' },
    ]);

    // OmitKeys
    expect(await QAsync(await source()).OmitKeys('age', 'tags', 'dob', 'status', 'role').ToArrayAsync()).toEqual([
      { id: 1, name: 'Josh' },
      { id: 2, name: 'Amy' },
      { id: 3, name: 'Dave' },
    ]);

    // Explain & ExplainText
    const q = QAsync(await source()).WhereEq('name', 'Amy');
    expect(q.Explain()).toBeDefined();
    expect(q.ExplainText()).toBeDefined();
  });
});
