/**
 * Lightweight discriminated-union Result type for operations that can fail.
 * Replaces ad-hoc `{ ok: boolean; error?: string }` patterns.
 */

export type Result<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail(error: string): Result<never> {
  return { ok: false, error };
}

export function fromTry<T>(fn: () => T): Result<T> {
  try {
    return ok(fn());
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function fromAsync<T>(p: Promise<T>): Promise<Result<T>> {
  try {
    return ok(await p);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}
