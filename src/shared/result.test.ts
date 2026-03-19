import { describe, it, expect } from "vitest";
import { ok, fail, fromTry, fromAsync } from "./result";

describe("ok", () => {
  it("creates a success result", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });
});

describe("fail", () => {
  it("creates a failure result", () => {
    const r = fail("bad");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("bad");
  });
});

describe("fromTry", () => {
  it("returns ok on success", () => {
    const r = fromTry(() => 10);
    expect(r).toEqual({ ok: true, value: 10 });
  });

  it("returns fail on thrown error", () => {
    const r = fromTry(() => { throw new Error("boom"); });
    expect(r).toEqual({ ok: false, error: "boom" });
  });

  it("stringifies non-Error throws", () => {
    const r = fromTry(() => { throw "oops"; });
    expect(r).toEqual({ ok: false, error: "oops" });
  });
});

describe("fromAsync", () => {
  it("returns ok on resolved promise", async () => {
    const r = await fromAsync(Promise.resolve("hi"));
    expect(r).toEqual({ ok: true, value: "hi" });
  });

  it("returns fail on rejected promise", async () => {
    const r = await fromAsync(Promise.reject(new Error("async fail")));
    expect(r).toEqual({ ok: false, error: "async fail" });
  });
});
