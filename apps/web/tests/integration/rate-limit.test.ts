import { describe, expect, it } from "vitest";
import { adminClient, anonClient, must, uniqueKey } from "./support";

const hit = async (key: string, limit: number, windowSeconds = 60): Promise<boolean> =>
  must(
    await adminClient().rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    }),
  );

describe("rate_limit_hit", () => {
  it("allows requests up to the limit and refuses the next", async () => {
    const key = uniqueKey();

    expect(await hit(key, 3)).toBe(true);
    expect(await hit(key, 3)).toBe(true);
    expect(await hit(key, 3)).toBe(true);
    expect(await hit(key, 3)).toBe(false);
  });

  it("holds when 50 requests arrive at once", async () => {
    const key = uniqueKey();
    const limit = 10;

    const results = await Promise.all(Array.from({ length: 50 }, () => hit(key, limit)));

    expect(results.filter(Boolean)).toHaveLength(limit);
  });

  it("counts each key on its own", async () => {
    const first = uniqueKey();
    const second = uniqueKey();

    expect(await hit(first, 1)).toBe(true);
    expect(await hit(first, 1)).toBe(false);
    expect(await hit(second, 1)).toBe(true);
  });

  it("starts again in the next window", async () => {
    const key = uniqueKey();

    expect(await hit(key, 1, 1)).toBe(true);
    expect(await hit(key, 1, 1)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(await hit(key, 1, 1)).toBe(true);
  });

  it("refuses everything when the limit is zero or less", async () => {
    expect(await hit(uniqueKey(), 0)).toBe(false);
    expect(await hit(uniqueKey(), -1)).toBe(false);
  });

  it("rejects a window that is not a positive number of seconds", async () => {
    const { error } = await adminClient().rpc("rate_limit_hit", {
      p_key: uniqueKey(),
      p_limit: 1,
      p_window_seconds: 0,
    });
    expect(error).not.toBeNull();
  });

  it("cannot be called from a browser", async () => {
    const { error } = await anonClient().rpc("rate_limit_hit", {
      p_key: uniqueKey(),
      p_limit: 1,
      p_window_seconds: 60,
    });
    expect(error).not.toBeNull();
  });

  it("keeps its counters out of reach of the API", async () => {
    const { error } = await anonClient().from("rate_limits").select("*");
    expect(error).not.toBeNull();
  });
});
