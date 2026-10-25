import { describe, expect, it } from "vitest";
import type { BlockView } from "@/lib/pattern-library/records";
import { eligibleForPatternService, HAS_PATTERN_TEXT, NO_SLOT_TEXT } from "./eligibility";

const block = (productKey: string, kind: BlockView["kind"] = "pieces") => ({ productKey, kind }) as BlockView;

describe("eligibleForPatternService", () => {
  it("is open for an article with no block", () => {
    expect(eligibleForPatternService("shorts", [])).toEqual({ ok: true });
    expect(eligibleForPatternService("shorts", [block("crew-tee")])).toEqual({ ok: true });
  });
  it("is closed when the article already has a pattern block", () => {
    expect(eligibleForPatternService("shorts", [block("shorts")])).toEqual({ ok: false, reason: HAS_PATTERN_TEXT });
  });
  it("is not closed by a knit programme of the same key", () => {
    expect(eligibleForPatternService("shorts", [block("shorts", "knit-programme")])).toEqual({ ok: true });
  });
  it("is closed for socks, a knitting programme, and for an unknown garment", () => {
    expect(eligibleForPatternService("socks", [])).toEqual({ ok: false, reason: NO_SLOT_TEXT });
    expect(eligibleForPatternService("spaceship", [])).toEqual({ ok: false, reason: NO_SLOT_TEXT });
  });
});
