import { describe, expect, it, vi } from "vitest";

/**
 * The last resort of `nearestSublimationSafe`. Pulling the chroma in always ends at a grey, which
 * today's estimate accepts, so this path cannot be reached with the real estimate. It exists because
 * the estimate is a setting that may tighten, and this test is the only way to walk it: the estimate
 * is stood in for with one that refuses every colour.
 */

vi.mock("@/lib/guardrails/gamut", () => ({ isInsideApproxGamut: () => false }));

describe("when the estimate accepts no colour at all", () => {
  it("falls back to the colour with no chroma, and still says it is an estimate", async () => {
    const { nearestSublimationSafe } = await import("./palette");
    const { toLch } = await import("./convert");
    const match = nearestSublimationSafe("#c8102e");
    expect(match.inGamut).toBe(false);
    expect(toLch(match.safeHex).c).toBeLessThan(2);
    expect(match.deltaE).toBeGreaterThan(0);
    expect(match.warning).toContain("Knitwright's own estimate");
  });
});
