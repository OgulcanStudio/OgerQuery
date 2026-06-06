import { describe, it, expect } from 'vitest';
import {
  compareNullSortKeys,
  filterFieldRoot,
  isSafePropertyKey,
  getByPath,
} from '../../src/utils/path.js';

describe('path utils', () => {
  it('filterFieldRoot and isSafePropertyKey', () => {
    expect(filterFieldRoot('id')).toBe('id');
    expect(filterFieldRoot('profile.age')).toBe('profile');
    expect(filterFieldRoot('.leading')).toBe('');
    expect(isSafePropertyKey('id')).toBe(true);
    expect(isSafePropertyKey('__proto__')).toBe(false);
  });

  it('compareNullSortKeys covers all null-order branches', () => {
    expect(compareNullSortKeys(1, 2, 'last')).toBeNull();
    expect(compareNullSortKeys(null, null, 'last')).toBe(0);
    expect(compareNullSortKeys(null, 1, 'first')).toBe(-1);
    expect(compareNullSortKeys(null, 1, 'last')).toBe(1);
    expect(compareNullSortKeys(1, null, 'first')).toBe(1);
    expect(compareNullSortKeys(1, null, 'last')).toBe(-1);
    expect(compareNullSortKeys(1, undefined, 'last')).toBe(-1);
  });

  it('getByPath gets property value by path or throws/returns undefined', () => {
    const obj = { profile: { age: 30 } };
    expect(getByPath(obj, '')).toBe(obj);
    expect(getByPath(obj, 'profile.age')).toBe(30);
    expect(getByPath(obj, 'profile.name')).toBeUndefined();
    expect(getByPath(null, 'profile.age')).toBeUndefined();
    expect(getByPath({ profile: 1 }, 'profile.age')).toBeUndefined();
    expect(() => getByPath(obj, 'invalid..path')).toThrow('Invalid property path');
  });
});
