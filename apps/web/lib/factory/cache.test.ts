import { describe, expect, it } from "vitest";
import { createKeyedCache } from "./cache";

/** The profile cache: one load per key until it is invalidated or its time is up. A failed load is not kept. */

const counter = () => {
  const calls: string[] = [];
  return { calls, load: async (key: string) => { calls.push(key); return `${key}:${calls.length}`; } };
};

describe("createKeyedCache", () => {
  it("loads a key once and answers from the cache after that", async () => {
    const { calls, load } = counter();
    const cache = createKeyedCache({ load, ttlMs: 1000, now: () => 0 });
    expect(await cache.get("a")).toBe("a:1");
    expect(await cache.get("a")).toBe("a:1");
    expect(calls).toEqual(["a"]);
  });

  it("keeps each key apart", async () => {
    const { calls, load } = counter();
    const cache = createKeyedCache({ load, ttlMs: 1000, now: () => 0 });
    expect([await cache.get("a"), await cache.get("b")]).toEqual(["a:1", "b:2"]);
    expect(calls).toEqual(["a", "b"]);
  });

  it("loads again once the entry's time is up", async () => {
    const { load } = counter();
    let clock = 0;
    const cache = createKeyedCache({ load, ttlMs: 1000, now: () => clock });
    expect(await cache.get("a")).toBe("a:1");
    clock = 999;
    expect(await cache.get("a")).toBe("a:1");
    clock = 1000;
    expect(await cache.get("a")).toBe("a:2");
  });

  it("drops one key on invalidate and every key on clear", async () => {
    const { load } = counter();
    const cache = createKeyedCache({ load, ttlMs: 1000, now: () => 0 });
    await cache.get("a");
    await cache.get("b");
    cache.invalidate("a");
    expect(await cache.get("a")).toBe("a:3");
    expect(await cache.get("b")).toBe("b:2");
    cache.clear();
    expect(await cache.get("b")).toBe("b:4");
  });

  it("does not keep a failed load: the next read tries again", async () => {
    let fail = true;
    const cache = createKeyedCache({
      load: async () => {
        if (fail) throw new Error("no");
        return "ok";
      },
      ttlMs: 1000,
      now: () => 0,
    });
    await expect(cache.get("a")).rejects.toThrow("no");
    fail = false;
    expect(await cache.get("a")).toBe("ok");
  });

  it("uses the clock by default", async () => {
    const cache = createKeyedCache({ load: async (key: string) => key, ttlMs: 1 });
    expect(await cache.get("a")).toBe("a");
  });
});
