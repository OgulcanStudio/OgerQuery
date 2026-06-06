import type { PipelineOp } from './pipelineOps.js';

export class OpPipeline<T> {
  readonly ops: PipelineOp<T>[];

  constructor(ops: PipelineOp<T>[] = []) {
    this.ops = ops;
  }

  append(op: PipelineOp<T>): OpPipeline<T> {
    return new OpPipeline([...this.ops, op]);
  }

  replaceLast(op: PipelineOp<T>): OpPipeline<T> {
    if (this.ops.length === 0) {
      return new OpPipeline([op]);
    }
    const next = this.ops.slice(0, -1);
    next.push(op);
    return new OpPipeline(next);
  }

  get last(): PipelineOp<T> | undefined {
    return this.ops[this.ops.length - 1];
  }

  isEmpty(): boolean {
    return this.ops.length === 0;
  }
}
