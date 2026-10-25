import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { REFERENCE_EDGE } from "@/lib/images/reference";
import { ProviderError } from "@/lib/providers/image-provider";
import type { StudioDesign } from "../studio";
import type { Budget } from "./budget";
import { ATTEMPTS, lifestyleGenerator, seedFor, type LifestyleDeps, type LifestyleReport } from "./generator";
import { isLabelledAi } from "./label";
import type { LifestyleProvider, LifestyleRequest } from "./provider";
import { buildReference } from "./reference";
import { SCENE_IDS, SCENE_VIEWS } from "./scenes";
import { stubLifestyleProvider } from "./stub";
import { studioDesign } from "./test-deps";

// Each run draws and checks four 1024 px pictures; a loaded CI runner needs more than the default five seconds.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const signal = new AbortController().signal;
const request = { design: { projectId: "p1", version: 3 } };
let design: StudioDesign;
beforeAll(async () => {
  design = await studioDesign();
});

const free: Budget = { take: async () => ({ ok: true, refund: async () => {} }) };

const wrap = (inner: LifestyleProvider, change: (png: Uint8Array, req: LifestyleRequest, call: number) => Promise<Uint8Array>, name = "wrapped"): LifestyleProvider & { calls: LifestyleRequest[] } => {
  const calls: LifestyleRequest[] = [];
  return {
    name,
    costMicrodollars: 100,
    scenes: inner.scenes,
    needsModelImage: inner.needsModelImage,
    calls,
    async generate(req, s) {
      // The index is taken when the call is made: the scenes run side by side, and reading calls.length after the
      // await let a fast scene's retry change the number a slower scene's first attempt saw.
      const call = calls.push(req);
      return change(await inner.generate(req, s), req, call);
    },
  };
};

const hueShift = async (png: Uint8Array) => new Uint8Array(await sharp(png).modulate({ hue: 150 }).png().toBuffer());

const run = async (overrides: Partial<LifestyleDeps> & Pick<LifestyleDeps, "providers">) => {
  let report: LifestyleReport | undefined;
  const generator = lifestyleGenerator({ loadDesign: async () => design, budget: free, onReport: (r) => (report = r), ...overrides });
  const result = await generator.generate(request, signal);
  return { result, report: report as LifestyleReport };
};

describe("lifestyleGenerator with the stub", () => {
  it("makes the four pictures, each passed by the checker, labelled and on its own view", async () => {
    const { result, report } = await run({ providers: [stubLifestyleProvider()] });
    if (!result.ok) throw new Error(result.message);
    expect(result.media.map((m) => m.view)).toEqual(SCENE_IDS.map((id) => SCENE_VIEWS[id]));
    for (const m of result.media) {
      expect(m.kind).toBe("lifestyle");
      expect(m.checker).toBe("passed");
      expect(m.provider).toBe("stub-lifestyle");
      expect(m.costMicrodollars).toBe(0);
      expect(isLabelledAi(m.png)).toBe(true);
      expect(m.width).toBe(REFERENCE_EDGE);
      expect(m.height).toBe(REFERENCE_EDGE);
    }
    expect(report).toMatchObject({ total: 4, kept: 4, passedFirstTry: 4 });
  });

  it("gives the same bytes for the same design", async () => {
    const a = await run({ providers: [stubLifestyleProvider()] });
    const b = await run({ providers: [stubLifestyleProvider()] });
    if (!a.result.ok || !b.result.ok) throw new Error("failed");
    a.result.media.forEach((m, i) => expect(Buffer.compare(m.png, b.result.ok ? (b.result.media[i]?.png ?? new Uint8Array()) : new Uint8Array())).toBe(0));
  });

  it("says so when the design cannot be drawn", async () => {
    const generator = lifestyleGenerator({ loadDesign: async () => null, providers: [stubLifestyleProvider()], budget: free });
    expect(await generator.generate(request, signal)).toMatchObject({ ok: false });
  });

  it("sends the provider the fixed prompt, the render, the transparent garment and a seed", async () => {
    const spy = wrap(stubLifestyleProvider(), async (png) => png);
    await run({ providers: [spy] });
    expect(spy.calls).toHaveLength(4);
    const first = spy.calls.find((c) => c.scene === "pitch");
    const reference = await buildReference(design);
    expect(Buffer.compare(first?.reference ?? new Uint8Array(), reference.opaque)).toBe(0);
    expect((await sharp(first?.garment).metadata()).hasAlpha).toBe(true);
    expect(first?.prompt).toMatch(/pitch/);
    expect(first?.seed).toBe(seedFor(request.design, "pitch", 0));
    expect(first?.modelImage).toBeNull();
  });

  it("passes the model picture to the provider when one is set", async () => {
    const spy = wrap(stubLifestyleProvider(), async (png) => png);
    const person = new Uint8Array([1, 2, 3]);
    await run({ providers: [spy], loadModelImage: async () => person });
    expect(spy.calls.every((c) => c.modelImage === person)).toBe(true);
  });
});

describe("protected marks", () => {
  it("finds the crest and the lettering of the design to protect", async () => {
    const { regions } = await buildReference(design);
    expect(regions.length).toBeGreaterThanOrEqual(1);
    expect(regions.some((r) => r.kind === "sponsor")).toBe(true);
  });

  it("drops a picture whose logo was painted out, so a sponsor never shows without its logo", async () => {
    const { regions } = await buildReference(design);
    const logo = regions.find((r) => r.kind === "sponsor");
    if (!logo) throw new Error("no logo region");
    const blank = wrap(stubLifestyleProvider(), async (png) => {
      const patch = await sharp({ create: { width: logo.width, height: logo.height, channels: 3, background: "#808080" } }).png().toBuffer();
      return new Uint8Array(await sharp(png).composite([{ input: patch, left: logo.x, top: logo.y }]).png().toBuffer());
    });
    const { result, report } = await run({ providers: [blank] });
    if (!result.ok) throw new Error(result.message);
    expect(result.media).toHaveLength(0);
    expect(report.outcomes.every((o) => o.rejectedFor.some((code) => code.startsWith("protected")))).toBe(true);
  });
});

describe("a rejected picture", () => {
  it("is tried once more with a different seed and kept when the second passes", async () => {
    const flaky = wrap(stubLifestyleProvider(), async (png, _req, call) => (call <= 4 ? hueShift(png) : png));
    const { result, report } = await run({ providers: [flaky] });
    if (!result.ok) throw new Error(result.message);
    expect(result.media).toHaveLength(4);
    expect(flaky.calls).toHaveLength(8);
    const seeds = flaky.calls.filter((c) => c.scene === "street").map((c) => c.seed);
    expect(new Set(seeds).size).toBe(2);
    expect(report.passedFirstTry).toBe(0);
    expect(report.kept).toBe(4);
    expect(report.outcomes[0]?.rejectedFor.some((code) => code.includes("colour"))).toBe(true);
    expect(result.media[0]?.costMicrodollars).toBe(200);
  });

  it("is dropped after the retry and never reaches the set", async () => {
    const bad = wrap(stubLifestyleProvider(), async (png) => hueShift(png));
    const { result, report } = await run({ providers: [bad] });
    if (!result.ok) throw new Error(result.message);
    expect(result.media).toEqual([]);
    expect(bad.calls).toHaveLength(4 * ATTEMPTS);
    expect(report).toMatchObject({ total: 4, kept: 0, passedFirstTry: 0 });
    expect(report.outcomes.every((o) => o.dropped === "rejected" && o.attempts === 2 && o.costMicrodollars === 200)).toBe(true);
  });

  it("keeps the passed pictures when only some fail, and counts first-try passes", async () => {
    const half = wrap(stubLifestyleProvider(), async (png, req) => (req.scene === "street" ? hueShift(png) : png));
    const { result, report } = await run({ providers: [half] });
    if (!result.ok) throw new Error(result.message);
    expect(result.media.map((m) => m.view)).toEqual(["scene", "three_quarter", "on_model"]);
    expect(report).toMatchObject({ kept: 3, passedFirstTry: 3 });
  });

  it("rejects a picture of another shape instead of stretching it", async () => {
    const wide = wrap(stubLifestyleProvider(), async (png) => new Uint8Array(await sharp(png).resize(1024, 512, { fit: "fill" }).png().toBuffer()));
    const { report } = await run({ providers: [wide] });
    expect(report.outcomes[0]?.rejectedFor).toContain("canvas_mismatch");
  });

  it("brings a picture of the right shape and another size onto the canvas", async () => {
    const small = wrap(stubLifestyleProvider(), async (png) => new Uint8Array(await sharp(png).resize(512, 512).png().toBuffer()));
    const { result } = await run({ providers: [small] });
    if (!result.ok) throw new Error(result.message);
    expect(result.media).toHaveLength(4);
    expect(result.media[0]?.width).toBe(REFERENCE_EDGE);
  });

  it("rejects bytes that are not a picture", async () => {
    const junk = wrap(stubLifestyleProvider(), async () => new Uint8Array([1, 2, 3]));
    const { report } = await run({ providers: [junk] });
    expect(report.outcomes[0]?.rejectedFor).toContain("unreadable_generated");
  });

  it("gives the checker the thresholds it was configured with", async () => {
    const shifted = wrap(stubLifestyleProvider(), async (png) => new Uint8Array(await sharp(png).modulate({ hue: 20 }).png().toBuffer()));
    const strict = await run({ providers: [shifted], thresholds: { maxColourDeltaE: 1 } });
    expect(strict.report.kept).toBe(0);
  });

  it("drops a scene when the checker cannot run, and still returns the set", async () => {
    const { result, report } = await run({ providers: [stubLifestyleProvider()], thresholds: { maxColourDeltaE: 999 } });
    expect(result).toMatchObject({ ok: true, media: [] });
    expect(report.outcomes.every((o) => o.dropped === "check_failed" && o.attempts === 2)).toBe(true);
  });
});

describe("providers that fail", () => {
  const failing = (refused: boolean, onlyFirst = false): LifestyleProvider & { n: number } => {
    const base = stubLifestyleProvider();
    const provider = {
      n: 0,
      name: "flaky",
      costMicrodollars: 100,
      scenes: base.scenes,
      async generate(req: LifestyleRequest, s: AbortSignal) {
        provider.n++;
        if (!onlyFirst || provider.n <= 4) throw new ProviderError("down", refused);
        return base.generate(req, s);
      },
    };
    return provider;
  };

  it("gives the cost back and does not retry when the provider refuses", async () => {
    const refund = vi.fn(async () => {});
    const budget: Budget = { take: async () => ({ ok: true, refund }) };
    const provider = failing(true);
    const { result, report } = await run({ providers: [provider], budget });
    if (!result.ok) throw new Error(result.message);
    expect(result.media).toEqual([]);
    expect(provider.n).toBe(4);
    expect(refund).toHaveBeenCalledTimes(4);
    expect(report.outcomes.every((o) => o.dropped === "provider_failed" && o.costMicrodollars === 0)).toBe(true);
  });

  it("retries a provider that could not be reached", async () => {
    const provider = failing(false, true);
    const { result } = await run({ providers: [provider] });
    if (!result.ok) throw new Error(result.message);
    expect(result.media).toHaveLength(4);
    expect(provider.n).toBe(8);
  });

  it("treats an error that is not a provider's as a failed attempt", async () => {
    const base = stubLifestyleProvider();
    const boom: LifestyleProvider = { ...base, async generate() { throw new Error("x"); } };
    const { report } = await run({ providers: [boom] });
    expect(report.outcomes[0]).toMatchObject({ dropped: "provider_failed", attempts: 2 });
  });
});

describe("limits and providers", () => {
  it("drops a scene the budget refuses, without calling the provider", async () => {
    const spy = wrap(stubLifestyleProvider(), async (png) => png);
    const { report } = await run({ providers: [spy], budget: { take: async () => ({ ok: false, reason: "daily_cap" }) } });
    expect(spy.calls).toHaveLength(0);
    expect(report.outcomes.every((o) => o.dropped === "daily_cap" && o.attempts === 0)).toBe(true);
  });

  it("does not start a second paid attempt once the first spend used up the allowance", async () => {
    let n = 0;
    const budget: Budget = { take: async () => (++n <= 4 ? { ok: true, refund: async () => {} } : { ok: false, reason: "allowance" }) };
    const bad = wrap(stubLifestyleProvider(), async (png) => hueShift(png));
    const { report } = await run({ providers: [bad], budget });
    expect(bad.calls).toHaveLength(4);
    expect(report.outcomes.every((o) => o.dropped === "allowance")).toBe(true);
  });

  it("uses a try-on provider for the model scene and a scene provider for the others", async () => {
    const base = stubLifestyleProvider();
    const tryOn = wrap({ ...base, scenes: ["on_model"] }, async (png) => png, "tryon");
    const scenes = wrap({ ...base, scenes: ["pitch", "changing_room", "street"] }, async (png) => png, "scenes");
    const { result } = await run({ providers: [scenes, tryOn] });
    if (!result.ok) throw new Error(result.message);
    expect(tryOn.calls.map((c) => c.scene)).toEqual(["on_model"]);
    expect(result.media.map((m) => m.provider)).toEqual(["scenes", "scenes", "scenes", "tryon"]);
  });

  it("leaves a try-on provider out when there is no picture of a person, and the scene provider makes the model scene", async () => {
    const base = stubLifestyleProvider();
    const tryOn = wrap({ ...base, scenes: ["on_model"], needsModelImage: true }, async (png) => png, "tryon");
    const scenes = wrap(base, async (png) => png, "scenes");
    const without = await run({ providers: [tryOn, scenes] });
    expect(tryOn.calls).toHaveLength(0);
    expect(without.report.outcomes[3]?.provider).toBe("scenes");
    const withPerson = await run({ providers: [tryOn, scenes], loadModelImage: async () => new Uint8Array([1]) });
    expect(withPerson.report.outcomes[3]?.provider).toBe("tryon");
  });

  it("reports a scene nobody can make instead of failing the set", async () => {
    const base = stubLifestyleProvider();
    const { result, report } = await run({ providers: [{ ...base, scenes: ["pitch"] }] });
    if (!result.ok) throw new Error(result.message);
    expect(result.media).toHaveLength(1);
    expect(report.outcomes.filter((o) => o.dropped === "no_provider")).toHaveLength(3);
  });

  it("stops making attempts once the time is up", async () => {
    const spy = wrap(stubLifestyleProvider(), async (png) => png);
    const expired = AbortSignal.abort();
    const result = await lifestyleGenerator({ loadDesign: async () => design, providers: [spy], budget: free }).generate(request, expired);
    expect(result).toMatchObject({ ok: true, media: [] });
    expect(spy.calls).toHaveLength(0);
  });

  it("gives seeds that are stable per design and scene and differ on a retry", () => {
    expect(seedFor(request.design, "pitch", 0)).toBe(seedFor(request.design, "pitch", 0));
    expect(seedFor(request.design, "pitch", 1)).not.toBe(seedFor(request.design, "pitch", 0));
    expect(seedFor(request.design, "street", 0)).not.toBe(seedFor(request.design, "pitch", 0));
  });
});
