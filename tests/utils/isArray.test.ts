import { describe, it, expect } from 'vitest';
import { isArray } from '../../src/utils/isArray.js';
describe('isArray', () => { it('detects arrays', () => { expect(isArray([1])).toBe(true); expect(isArray(new Set([1]))).toBe(false); }); });
