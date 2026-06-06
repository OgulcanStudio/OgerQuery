/** Kahan–Babuska compensated summation — reduces float drift on large financial aggregates. */
export class KahanSum {
  private sum = 0;
  private compensation = 0;

  add(value: number): void {
    const y = value - this.compensation;
    const t = this.sum + y;
    this.compensation = t - this.sum - y;
    this.sum = t;
  }

  get value(): number {
    return this.sum;
  }
}

export function kahanAdd(acc: { sum: number; compensation: number }, value: number): void {
  const y = value - acc.compensation;
  const t = acc.sum + y;
  acc.compensation = t - acc.sum - y;
  acc.sum = t;
}

export function kahanTotal(acc: { sum: number; compensation: number }): number {
  return acc.sum;
}
