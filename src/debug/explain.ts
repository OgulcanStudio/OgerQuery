import type { OpPipeline } from '../core/OpPipeline.js';
import type { PipelineOp } from '../core/pipelineOps.js';

export type ExplainStep = {
  index: number;
  kind: string;
  detail?: string | undefined;
};

function describeOp<T>(op: PipelineOp<T>): string | undefined {
  switch (op.kind) {
    case 'take':
      return `count=${op.count}`;
    case 'skip':
      return `count=${op.count}`;
    case 'orderBy':
      return `keys=${op.keys.length}`;
  }
  return undefined;
}

export function explainPipeline<T>(pipeline: OpPipeline<T>): ExplainStep[] {
  return pipeline.ops.map((op, index) => ({
    index,
    kind: op.kind,
    detail: describeOp(op),
  }));
}

export function explainPipelineText<T>(pipeline: OpPipeline<T>): string[] {
  return explainPipeline(pipeline).map(
    (step) => `${step.index}: ${step.kind}${step.detail ? ` (${step.detail})` : ''}`,
  );
}

let debugEnabled = false;

export function setDebugMode(enabled: boolean): void {
  debugEnabled = enabled;
}

export function isDebugMode(): boolean {
  return debugEnabled;
}

export function debugLog(message: string, ...args: unknown[]): void {
  if (debugEnabled) {
    console.debug(`[OgerQuery] ${message}`, ...args);
  }
}
