/** O(1) amortized sliding window — no Array.shift on large sequences. */
export class TakeLastBuffer<T> {
  private readonly buf: T[];
  private head = 0;
  private size = 0;

  constructor(private readonly capacity: number) {
    this.buf = capacity > 0 ? new Array(capacity) : [];
  }

  push(item: T): void {
    if (this.capacity <= 0) return;
    const idx = (this.head + this.size) % this.capacity;
    this.buf[idx] = item;
    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this.size; i++) {
      yield this.buf[(this.head + i) % this.capacity]!;
    }
  }
}

/** Yields items while holding the last `skip` in a fixed-size ring buffer. */
export class SkipLastBuffer<T> {
  private readonly buf: T[];
  private head = 0;
  private filled = 0;

  constructor(private readonly skip: number) {
    this.buf = skip > 0 ? new Array(skip) : [];
  }

  push(item: T): T | undefined {
    if (this.skip <= 0) return item;
    if (this.filled < this.skip) {
      this.buf[this.filled] = item;
      this.filled++;
      return undefined;
    }
    const out = this.buf[this.head]!;
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.skip;
    return out;
  }
}
