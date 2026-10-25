import { describe, expect, it, vi } from "vitest";
import type { UsageMeter } from "@/lib/usage/meter";
import { DEFAULT_DAILY_CAP_MICRODOLLARS } from "./budget";
import { dailyCapFrom, lifestyleGenerators, logReport } from "./register";
import { reportOf } from "./generator";

const usage: UsageMeter = { reserve: vi.fn(async () => ({ ok: true as const, eventId: "e" })), refund: vi.fn(async () => true) };
const deps = (env: Record<string, string>, log = vi.fn()) => ({ env, usage, client: {} as never, brandId: "b", userId: "u", loadDesign: async () => null, log });

describe("lifestyleGenerators", () => {
  it("registers nothing by default", () => {
    const log = vi.fn();
    expect(lifestyleGenerators(deps({}, log))).toEqual([]);
    expect(log).not.toHaveBeenCalled();
  });

  it("registers the generator when a provider is chosen", () => {
    expect(lifestyleGenerators(deps({ LIFESTYLE_SCENE_PROVIDER: "stub" }))).toMatchObject([{ name: "lifestyle" }]);
  });

  it("warns about a chosen provider with no key and registers nothing", () => {
    const log = vi.fn();
    expect(lifestyleGenerators(deps({ LIFESTYLE_SCENE_PROVIDER: "photoroom" }, log))).toEqual([]);
    expect(log).toHaveBeenCalledWith({ level: "warn", message: "photoroom is chosen but PHOTOROOM_API_KEY is not set.", where: "lifestyle" });
  });

  it("reports through the log when a set has been made", async () => {
    const log = vi.fn();
    const [generator] = lifestyleGenerators(deps({ LIFESTYLE_SCENE_PROVIDER: "stub" }, log));
    expect(await generator?.generate({ design: { projectId: "p", version: 1 } }, new AbortController().signal)).toMatchObject({ ok: false });
    expect(log).not.toHaveBeenCalled();
  });
});

describe("dailyCapFrom", () => {
  it("takes a positive whole number and otherwise the default", () => {
    expect(dailyCapFrom("250000")).toBe(250_000);
    for (const bad of [undefined, "", "0", "-5", "1.5", "abc"]) expect(dailyCapFrom(bad)).toBe(DEFAULT_DAILY_CAP_MICRODOLLARS);
  });
});

describe("logReport", () => {
  it("says how many pictures were kept and passed the first time", () => {
    const log = vi.fn();
    const outcome = (kept: boolean, first: boolean) => ({ scene: "pitch" as const, provider: "p", attempts: 1, passedFirstTry: first, kept, dropped: kept ? null : ("rejected" as const), rejectedFor: [], costMicrodollars: 0 });
    logReport(log, reportOf([outcome(true, true), outcome(false, false)]));
    expect(log.mock.calls[0]?.[0].message).toContain("1 of 2 kept, 1 passed the first time");
  });
});
