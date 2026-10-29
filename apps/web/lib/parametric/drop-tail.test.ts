import { describe, expect, it } from "vitest";
import { len, type Pt } from "./geometry";
import {
  BUNDLED_ARTICLES,
  draftArticle,
  draftConstantsSchema,
  draftConstantsSource,
  outlineProblems,
  reviewPack,
  SEEDED_DRAFT_CONSTANTS,
  type ArticleDefinition,
  type ArticleDraft,
  type DraftConstants,
  type DraftPiece,
} from "./index";
import { conventionProblem, hemLine } from "./jsy-ss-01/drop-tail";

/**
 * Owner decision 6, the drop-tail convention: the hem is level from centre front to the side seam;
 * the drop begins at the side seam; the side-seam length is unchanged, so the front hem never
 * moves; the back hem falls on one smooth curve from side seam to centre back, horizontal where it
 * meets the centre-back fold. Each of those four facts is asserted below, across the whole range.
 */

const JSY = BUNDLED_ARTICLES.get("JSY-SS-01") as ArticleDefinition;
const CONSTANTS = SEEDED_DRAFT_CONSTANTS.get("JSY-SS-01") as DraftConstants;
const CONVENTION = CONSTANTS.values.drop_tail.convention;
const SIZES = JSY.sizes;
const TAIL = JSY.parameters.find((p) => p.key === "back_drop_tail") as ArticleDefinition["parameters"][number];
/** Every value the range allows, the ends included: 0, 10, 20, 30, 40 mm. */
const DROPS = Array.from({ length: (TAIL.max - TAIL.min) / TAIL.step + 1 }, (_, i) => TAIL.min + i * TAIL.step);

const drafted = (size: string, drop: number): ArticleDraft => {
  const outcome = draftArticle("JSY-SS-01", size, { parameters: { back_drop_tail: drop } });
  if (outcome.kind !== "drafted") throw new Error(`${outcome.kind}: ${JSON.stringify(outcome)}`);
  return outcome.draft;
};

const piece = (draft: ArticleDraft, id: string): DraftPiece => draft.pieces.find((p) => p.id === id) as DraftPiece;
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** The length of the side seam as the drafted piece has it, from the underarm to the side hem. */
const sideSeam = (p: DraftPiece) => dist(p.landmarks.underarm, p.landmarks["side-hem"]);

/** The hem run of a body sew line: from the right side hem round to the left. */
function hemOf(p: DraftPiece): Pt[] {
  const side = p.landmarks["side-hem"];
  const start = p.sewLine.findIndex((q) => q[0] === side[0] && q[1] === side[1]);
  const end = p.sewLine.findIndex((q) => q[0] === -side[0] && q[1] === side[1]);
  return p.sewLine.slice(start, end + 1);
}

describe("the convention on file is the one the drafter draws", () => {
  it("states the four facts of owner decision 6", () => {
    expect(CONVENTION).toMatchObject({
      hem_level_to_side_seam: true,
      drop_starts_at: "side-seam",
      side_seam_length_unchanged: true,
      front_hem_moves: false,
      back_hem_curve: "one-smooth-curve",
      horizontal_at_centre_back: true,
    });
    expect(conventionProblem(CONVENTION)).toBeNull();
  });

  it.each([
    ["hem_level_to_side_seam", false, /not level from centre front/],
    ["drop_starts_at", "centre-back", /starts at the centre-back/],
    ["side_seam_length_unchanged", false, /side-seam length is not kept/],
    ["front_hem_moves", true, /front hem moves/],
    ["back_hem_curve", "two-straight-lines", /not one smooth curve/],
    ["horizontal_at_centre_back", false, /not horizontal where it meets/],
  ])("does not draft a drop tail when the convention says %s is %s", (key, value, message) => {
    const values = { ...CONSTANTS.values, drop_tail: { convention: { ...CONVENTION, [key]: value } } };
    const constants = draftConstantsSchema.parse({ labels: CONSTANTS.labels, values });
    const sources = { constants: draftConstantsSource({ "JSY-SS-01": constants }) };
    const outcome = draftArticle("JSY-SS-01", "M", { parameters: { back_drop_tail: 20 } }, sources);
    expect(outcome).toMatchObject({ kind: "not-drafted-yet", ruleId: "R-PAT-005" });
    expect(outcome.kind === "not-drafted-yet" && outcome.reason).toMatch(message);
    // A convention it cannot draw stops the drop tail, not the level hem.
    expect(draftArticle("JSY-SS-01", "M", {}, sources).kind).toBe("drafted");
  });
});

describe.each(SIZES)("size %s across the whole drop-tail range", (size) => {
  const level = drafted(size, 0);

  it("keeps the side-seam length, on the back as on the front", () => {
    const wanted = sideSeam(piece(level, "front"));
    for (const drop of DROPS) {
      const draft = drafted(size, drop);
      expect({ drop, back: sideSeam(piece(draft, "back")), front: sideSeam(piece(draft, "front")) }).toEqual({ drop, back: wanted, front: wanted });
    }
  });

  it("never touches the front, hem included", () => {
    for (const drop of DROPS) expect(piece(drafted(size, drop), "front")).toEqual(piece(level, "front"));
  });

  it("drops the back hem by the drop tail at the centre-back fold, and only there", () => {
    for (const drop of DROPS) {
      const back = piece(drafted(size, drop), "back");
      const hem = hemOf(back);
      expect(back.landmarks["cb-hem"]).toEqual([0, level.checks[5].target + drop]);
      expect(hem[0]).toEqual(piece(level, "back").landmarks["side-hem"]);
      expect(Math.max(...hem.map((p) => p[1])) - Math.min(...hem.map((p) => p[1]))).toBeCloseTo(drop, 9);
    }
  });

  it("meets the centre-back fold horizontally, flattening as it arrives", () => {
    for (const drop of DROPS.filter((d) => d > 0)) {
      const hem = hemOf(piece(drafted(size, drop), "back"));
      const fold = hem.findIndex((p) => p[0] === 0);
      expect(fold).toBeGreaterThan(0);
      const slope = (i: number) => Math.abs((hem[i][1] - hem[i - 1][1]) / (hem[i][0] - hem[i - 1][0]));
      // The last hem segment before the fold is within a hundredth of level, and under 0.05 mm of rise.
      expect(slope(fold)).toBeLessThan(0.01);
      expect(fold === 0 ? 0 : hem[fold][1] - hem[fold - 1][1]).toBeLessThan(0.05);
      // And the hem is flattening into the fold rather than arriving at an angle.
      expect(slope(fold)).toBeLessThan(slope(fold - 1));
      expect(slope(fold - 1)).toBeLessThan(slope(fold - 2));
    }
  });

  it("gives closed, non-self-intersecting panels at every value of the range", () => {
    for (const drop of DROPS) {
      for (const p of drafted(size, drop).pieces) {
        expect({ drop, piece: p.id, cut: outlineProblems(p.cutLine), sew: outlineProblems(p.sewLine) }).toEqual({ drop, piece: p.id, cut: [], sew: [] });
      }
    }
  });

  it("builds every point of measure within 0.5 mm, the drop included", () => {
    for (const drop of DROPS) {
      for (const c of drafted(size, drop).checks) expect(Math.abs(c.actual - c.target)).toBeLessThan(0.5);
    }
  });
});

describe("the hem itself", () => {
  it("is the reference script's level line, point for point, when there is no drop", () => {
    expect(hemLine(260, 720, 0, CONVENTION)).toEqual({ pts: [[260, 720], [-260, 720]], centre: [0, 720], centreDistance: 260 });
  });

  it("is one smooth curve: no repeated point, no reversal, and symmetric about the fold", () => {
    const hem = hemLine(260, 720, 40, CONVENTION);
    expect(hem.centre).toEqual([0, 760]);
    expect(hem.centreDistance).toBeCloseTo(len(hem.pts) / 2, 6);
    const xs = hem.pts.map((p) => p[0]);
    expect(xs.every((x, i) => i === 0 || x < xs[i - 1])).toBe(true);
    for (const [i, p] of hem.pts.entries()) expect(p[1]).toBeCloseTo(hem.pts[hem.pts.length - 1 - i][1], 9);
  });

  it("is longer than the level hem, which is why the hem operation changes (R-PAT-005)", () => {
    const level = len(hemLine(260, 720, 0, CONVENTION).pts);
    expect(len(hemLine(260, 720, 40, CONVENTION).pts)).toBeGreaterThan(level);
    const draft = drafted("M", 40);
    expect(draft.lengths.find((l) => l.label.startsWith("Back hem seam with the drop tail"))?.mm).toBeGreaterThan(level);
    expect(drafted("M", 0).lengths.some((l) => l.label.startsWith("Back hem seam"))).toBe(false);
  });
});

describe("a drafted drop tail in the review pack", () => {
  it("says what it was drafted with and gives the same bytes twice", () => {
    const first = reviewPack("JSY-SS-01", { parameters: { back_drop_tail: 30 } });
    const second = reviewPack("JSY-SS-01", { parameters: { back_drop_tail: 30 } });
    expect(first.kind).toBe("drafted");
    expect(first).toEqual(second);
    expect(first.kind === "drafted" && first.files["pattern-report.md"]).toContain("Drafted with back_drop_tail 30 mm.");
  });
});
