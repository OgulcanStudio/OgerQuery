export type Some<T> = { readonly ok: true; readonly value: T };
export type None = { readonly ok: false };
export type Option<T> = Some<T> | None;

export const None: None = { ok: false };

export function some<T>(value: T): Some<T> {
  return { ok: true, value };
}

export function fromNullable<T>(value: T | null | undefined): Option<T> {
  return value == null ? None : some(value);
}

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = Error> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export async function tryRun<T>(fn: () => T | Promise<T>): Promise<Result<T, Error>> {
  try {
    return ok(await fn());
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

export function tryRunSync<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn());
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}
