import { describe, expect, it } from "vitest";
import { bbox } from "./geometry";
import type { DraftInput } from "./types";
import {
  BUNDLED_ARTICLES,
  draftArticle,
  draftConstantsSchema,
  draftConstantsSource,
  labelOf,
  outlineProblems,
  pomValue,
  reviewPack,
  SEEDED_DRAFT_CONSTANTS,
  type ArticleDefinition,
  type ArticleDraft,
  type DraftConstants,
  type DraftPiece,
} from "./index";

/**
 * Owner decision 8: a POM is what a tape measure reads on the finished garment. POM D is measured
 * to the finished sleeve edge, cuff included, so the K02 cuff seam is DERIVED by subtracting the
 * cuff's finished depth, never the other way round. The cuff is a folded rectangle: twice the
 * finished depth plus two seam allowances deep, and the sleeve opening less the rib's negative
 * ease long.
 */

const JSY = BUNDLED_ARTICLES.get("JSY-SS-01") as ArticleDefinition;
const CONSTANTS = SEEDED_DRAFT_CONSTANTS.get("JSY-SS-01") as DraftConstants;
const RIB = CONSTANTS.values.cuff_k02.rib;
const SIZES = JSY.sizes;
const K02 = { options: { sleeve_finish: "K02" } };

const drafted = (size: string, input: DraftInput = K02): ArticleDraft => {
  const outcome = draftArticle("JSY-SS-01", size, input);
  if (outcome.kind !== "drafted") throw new Error(`${outcome.kind}: ${JSON.stringify(outcome)}`);
  return outcome.draft;
};
const piece = (draft: ArticleDraft, id: string): DraftPiece => draft.pieces.find((p) => p.id === id) as DraftPiece;
const lengthOf = (draft: ArticleDraft, start: string) => draft.lengths.find((l) => l.label.startsWith(start))?.mm ?? Number.NaN;

/** The rib's negative ease replaced, so a test can prove the value is read and not drawn from memory. */
function withNegativeEase(mm: number): DraftConstants {
  const values = { ...CONSTANTS.values, cuff_k02: { rib: { ...RIB, negative_ease_mm: mm } } };
  return draftConstantsSchema.parse({ labels: CONSTANTS.labels, values });
}

describe("the K02 cuff constants", () => {
  it("are a labelled default under the cuff's own rule, reviewed by nobody", () => {
    expect(labelOf(CONSTANTS, "cuff_k02.rib")).toMatchObject({ rule: "R-CON-008", label: "Knitwright draft v0.1, not reviewed by a factory" });
    // The 25 mm is article.json's own K02 option name; the negative ease has no source in the pack.
    expect(RIB.finished_depth_mm).toBe(25);
    expect(JSY.options.sleeve_finish.find((o) => o.code === "K02")?.name).toContain("25 mm finished");
    expect(labelOf(CONSTANTS, "cuff_k02.rib")?.source).toContain("no source in the pack");
  });
});

describe.each(SIZES)("size %s with the K02 cuff", (size) => {
  const draft = drafted(size);
  const D = pomValue(JSY, "D", size) as number;
  const F = pomValue(JSY, "F", size) as number;
  const E = pomValue(JSY, "E", size) as number;
  const sleeve = piece(draft, "sleeve");
  const cuff = piece(draft, "sleeve-cuff");

  it("adds the cuff as a fifth piece, cut two, in the rib fabric", () => {
    expect(draft.pieces.map((p) => p.id)).toEqual(["front", "back", "sleeve", "neck-rib", "sleeve-cuff"]);
    expect(cuff).toMatchObject({ label: "CUFF K02", cut: 2, mirroredPair: false, fabricCode: JSY.fabrics.rib.code });
  });

  it("derives the cuff seam from POM D and the cuff depth, instead of assuming it", () => {
    const seam = sleeve.landmarks["hem-a"];
    expect(seam[1]).toBe(D - RIB.finished_depth_mm);
    // POM D is the finished sleeve edge: the seam plus the cuff that hangs below it.
    expect(seam[1] + RIB.finished_depth_mm).toBe(D);
    expect(draft.checks.find((c) => c.label.startsWith("D sleeve length"))).toEqual({ label: "D sleeve length", target: D, actual: D });
    // A K01 sleeve ends at POM D itself, which is what makes the K02 seam derived rather than equal.
    expect(piece(drafted(size, {}), "sleeve").landmarks["hem-a"][1]).toBe(D);
  });

  it("reads the sleeve's width at the cuff seam off the underarm taper, between the bicep and the opening", () => {
    const half = sleeve.landmarks["hem-a"][0];
    expect(half).toBeGreaterThan(F);
    expect(half).toBeLessThan(E);
    expect(lengthOf(draft, "Sleeve edge at the cuff seam")).toBeCloseTo(2 * half, 9);
  });

  it("cuts the cuff as a folded rectangle: the opening less the negative ease, twice the depth plus two allowances", () => {
    const sa = JSY.seam_allowance.rib;
    const sewn = bbox(cuff.sewLine);
    const cut = bbox(cuff.cutLine);
    expect(sewn.x1 - sewn.x0).toBeCloseTo(2 * F - RIB.negative_ease_mm, 9);
    expect(sewn.y1 - sewn.y0).toBeCloseTo(2 * RIB.finished_depth_mm, 9);
    expect(cut.y1 - cut.y0).toBeCloseTo(2 * RIB.finished_depth_mm + 2 * sa, 9);
    expect(cut.x1 - cut.x0).toBeCloseTo(2 * F - RIB.negative_ease_mm + 2 * sa, 9);
    expect(lengthOf(draft, "Cuff K02 cut length")).toBeCloseTo(2 * F - RIB.negative_ease_mm, 9);
  });

  it("gives closed, non-self-intersecting panels, with the length parameters and a drop tail too", () => {
    const combos: Readonly<Record<string, number>>[] = [
      {},
      { sleeve_length_offset: -20 },
      { sleeve_length_offset: 40 },
      { body_length_offset: 40, back_drop_tail: 40 },
    ];
    for (const parameters of combos) {
      const combined = drafted(size, { ...K02, parameters });
      for (const p of combined.pieces) {
        expect({ parameters, piece: p.id, cut: outlineProblems(p.cutLine), sew: outlineProblems(p.sewLine) }).toEqual({
          parameters,
          piece: p.id,
          cut: [],
          sew: [],
        });
      }
      for (const c of combined.checks) expect(Math.abs(c.actual - c.target)).toBeLessThan(0.5);
    }
  });
});

describe("K02 beside K01", () => {
  it("leaves the body, the sleeve cap and the neck rib exactly as K01 draws them", () => {
    const k01 = drafted("M", {});
    const k02 = drafted("M");
    expect(k02.pieces.slice(0, 2)).toEqual(k01.pieces.slice(0, 2));
    expect(piece(k02, "neck-rib")).toEqual(piece(k01, "neck-rib"));
    expect(k02.lengths.slice(0, k01.lengths.length)).toEqual(k01.lengths);
    expect(k01.pieces).toHaveLength(4);
  });

  it("joins the cuff with the rib allowance, not the K01 hem turn-up", () => {
    const seams = (d: ArticleDraft) => Object.fromEntries(piece(d, "sleeve").seamAllowance.map((a) => [a.seamId, a.mm]));
    expect(seams(drafted("M", {}))["sleeve-hem"]).toBe(JSY.seam_allowance.sleeve_hem);
    expect(seams(drafted("M"))["cuff-join"]).toBe(JSY.seam_allowance.rib);
  });

  it("takes the cuff's length from the negative ease on file, nothing else", () => {
    const sources = { constants: draftConstantsSource({ "JSY-SS-01": withNegativeEase(0) }) };
    const outcome = draftArticle("JSY-SS-01", "M", K02, sources);
    const relaxed = outcome.kind === "drafted" ? piece(outcome.draft, "sleeve-cuff") : null;
    const F = pomValue(JSY, "F", "M") as number;
    expect(relaxed && bbox(relaxed.sewLine).x1 - bbox(relaxed.sewLine).x0).toBeCloseTo(2 * F, 9);
    expect(outcome.kind === "drafted" && piece(outcome.draft, "sleeve")).toEqual(piece(drafted("M"), "sleeve"));
  });

  it("writes the cuff into the review pack, with the same bytes twice", () => {
    const first = reviewPack("JSY-SS-01", K02);
    const second = reviewPack("JSY-SS-01", K02);
    expect(first).toEqual(second);
    expect(first.kind === "drafted" && first.files["JSY-SS-01_M.svg"]).toContain('id="cuff_k02"');
    expect(first.kind === "drafted" && first.files["pattern-report.md"]).toContain("Cuff K02 cut length");
  });

  it("still refuses the collars whose shape nobody has drawn", () => {
    for (const [code, ruleId] of [["C02", "R-CON-005"], ["C03", "R-CON-006"]]) {
      expect(draftArticle("JSY-SS-01", "M", { options: { collar: code, sleeve_finish: "K02" } })).toMatchObject({ kind: "not-drafted-yet", ruleId });
    }
  });
});
