import { describe, expect, it } from "vitest";
import { gradedPatternSchema } from "@/lib/production/contract";
import { DRAFTED_BLOCK_VERSION, draftedPattern } from "./pattern";

/**
 * Seam 3 of the wave 2 wiring: the production package's `PatternSource` over the graded drafter (X3). The
 * drafter has one script, JSY-SS-01, so every other launch article answers "not drafted yet" in words.
 */

const drafted = () => draftedPattern("JSY-SS-01");

describe("the drafted pattern source", () => {
  it("gives every size of the article as a graded pattern the production contract accepts", () => {
    const result = drafted();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pattern.blockId).toBe("JSY-SS-01");
    expect(result.pattern.blockVersion).toBe(DRAFTED_BLOCK_VERSION);
    expect(result.pattern.sizes).toEqual(["XS", "S", "M", "L", "XL", "2XL", "3XL"]);
    expect(result.articleVersion).toBe("0.1");
    expect(gradedPatternSchema.safeParse(result.pattern).success).toBe(true);
  });

  it("names the pieces of each size, with the size on every piece", () => {
    const result = drafted();
    if (!result.ok) throw new Error(result.reason);

    for (const size of result.pattern.sizes) {
      const pieces = result.pattern.piecesBySize[size]!;
      expect(pieces.length).toBeGreaterThan(0);
      expect(pieces.every((piece) => piece.sizeLabel === size)).toBe(true);
    }
  });

  it("passes on the drafter's warnings without stopping, because a range nobody sampled is not a refusal", () => {
    const result = drafted();
    if (!result.ok) throw new Error(result.reason);
    expect(result.warnings.every((warning) => warning.length > 0)).toBe(true);
  });

  it("is the source the assembler takes, and it resolves the same pattern", async () => {
    const result = drafted();
    if (!result.ok) throw new Error(result.reason);
    expect(await result.source.pattern()).toEqual(result.pattern);
  });

  it("gives the same pattern twice, for the same article and the same input", () => {
    const once = draftedPattern("JSY-SS-01", { parameters: { body_length_offset: 20 } });
    const again = draftedPattern("JSY-SS-01", { parameters: { body_length_offset: 20 } });
    expect(once.ok && once.pattern).toEqual(again.ok && again.pattern);
    expect(once.ok && once.warnings).toEqual(again.ok && again.warnings);
  });
});

describe("an article the drafter has nothing for", () => {
  it("says there is no drafting script, rather than drawing one", () => {
    const result = draftedPattern("SHO-TR-01");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("Not drafted yet");
    expect(result.reason).toContain("no drafting script for SHO-TR-01");
  });

  it("says so for an option whose shape the article does not define (C02 and C03, owner decision 8)", () => {
    const result = draftedPattern("JSY-SS-01", { options: { collar: "C02" } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("Not drafted yet");
  });

  it("passes on the drafter's findings for a value the article does not offer", () => {
    const result = draftedPattern("JSY-SS-01", { parameters: { body_length_offset: 500 } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("cannot be drafted as asked");
    expect(result.ruleId).toMatch(/^R-[A-Z]+-\d{3}$/);
  });
});
