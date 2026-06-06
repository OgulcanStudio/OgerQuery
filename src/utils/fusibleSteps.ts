import type { PipelineOp } from '../core/pipelineOps.js';
import type { Predicate } from '../core/types.js';

export type FusibleStep = {
  kind: 'where' | 'select' | 'take' | 'skip';
  fn?: (item: unknown, index: number) => unknown;
  val?: number;
  skipped?: number;
  taken?: number;
};

export function parseFusibleSteps<T>(
  ops: PipelineOp<unknown>[],
  predicate?: Predicate<T>,
): FusibleStep[] {
  const activeOps = predicate
    ? [...ops, { kind: 'where' as const, predicate: predicate as Predicate<unknown> }]
    : ops;
  const steps: FusibleStep[] = [];
  for (const op of activeOps) {
    switch (op.kind) {
      case 'where':
        steps.push({ kind: 'where', fn: op.predicate });
        break;
      case 'select':
        steps.push({ kind: 'select', fn: op.selector });
        break;
      case 'take':
        steps.push({ kind: 'take', val: op.count, taken: 0 });
        break;
      case 'skip':
        steps.push({ kind: 'skip', val: op.count, skipped: 0 });
        break;
    }
  }
  return steps;
}

/** Visit each element that survives fusible pipeline. Return false from visitor to stop early. */
export function forEachFusible<T>(
  source: T[],
  steps: FusibleStep[],
  visit: (item: unknown, index: number) => boolean | void,
): void {
  const stepsLen = steps.length;
  let index = 0;

  outer: for (let i = 0; i < source.length; i++) {
    let current: unknown = source[i];
    for (let j = 0; j < stepsLen; j++) {
      const step = steps[j]!;
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
          if (step.skipped! < step.val!) {
            step.skipped!++;
            index++;
            continue outer;
          }
          break;
        case 'take':
          if (step.taken! >= step.val!) {
            break outer;
          }
          step.taken!++;
          break;
      }
    }

    if (visit(current, index) === false) {
      break;
    }

    let allTakesDone = true;
    let hasTake = false;
    for (let j = 0; j < stepsLen; j++) {
      const step = steps[j]!;
      if (step.kind === 'take') {
        hasTake = true;
        if (step.taken! < step.val!) {
          allTakesDone = false;
          break;
        }
      }
    }
    if (hasTake && allTakesDone) {
      break;
    }

    index++;
  }
}
