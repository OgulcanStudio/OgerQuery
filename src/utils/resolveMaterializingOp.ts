import type { PipelineOp } from '../core/pipelineOps.js';
import { resolveIterable } from './resolveIterable.js';

export async function resolveMaterializingOpSecond<T>(
  op: PipelineOp<T>,
): Promise<PipelineOp<T>> {
  switch (op.kind) {
    case 'concat':
    case 'union':
    case 'intersect':
    case 'except':
    case 'unionBy':
    case 'intersectBy':
    case 'exceptBy':
      return {
        ...op,
        second: await resolveIterable(
          op.second as Iterable<unknown> | AsyncIterable<unknown>,
        ),
      };
    default:
      return op;
  }
}
