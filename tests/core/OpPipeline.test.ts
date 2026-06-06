import { describe, it, expect } from 'vitest';
import { OpPipeline } from '../../src/core/OpPipeline.js';
import { whereFeature } from '../../src/features/lazy/Where.js';
import { takeFeature } from '../../src/features/lazy/Take.js';

describe('OpPipeline', () => {
  it('fuses where and take', () => {
    let p = new OpPipeline<number>();
    p = whereFeature.append!(p, x => x > 0);
    p = whereFeature.append!(p, x => x < 10);
    p = takeFeature.append!(p, 5);
    p = takeFeature.append!(p, 3);
    expect(p.ops).toHaveLength(2);
    expect(p.last?.kind).toBe('take');
    if (p.last?.kind === 'take') expect(p.last.count).toBe(3);
  });
  it('replaceLast on empty creates op', () => {
    const p = new OpPipeline<number>().replaceLast({ kind: 'where', predicate: () => true });
    expect(p.ops).toHaveLength(1);
  });
});
