import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDxf } from "@/lib/pattern-library/dxf/parse";
import { BUNDLED_ARTICLES, draftArticle, reviewPack } from "./index";
import { len } from "./geometry";
import { selfIntersections } from "./validate";
import type { ArticleDraft } from "./types";

/**
 * Golden tests against the files the reference script committed in docs/spec/articles/JSY-SS-01:
 * the port draws the same pieces, the same lengths and the same report rows, and both its own
 * files and the committed ones measure back to the POM table of `article.json`.
 */

const ARTICLE_DIR = join(__dirname, "../../../../docs/spec/articles/JSY-SS-01");
const golden = (name: string): string => readFileSync(join(ARTICLE_DIR, "pattern", name), "utf8");
const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;
const ARTICLE = JSON.parse(readFileSync(join(ARTICLE_DIR, "article.json"), "utf8"));
const pom = (letter: string, size: string): number => ARTICLE.pom.find((p: { letter: string }) => p.letter === letter).values[size];

const pack = reviewPack("JSY-SS-01");
if (pack.kind !== "drafted") throw new Error(`the reference article must draft: ${pack.kind}`);
const files = pack.files;

const drafted = (size: string): ArticleDraft => {
  const outcome = draftArticle("JSY-SS-01", size);
  if (outcome.kind !== "drafted") throw new Error(outcome.kind);
  return outcome.draft;
};

type Pts = [number, number][];
type Poly = { layer: string; pts: Pts };

/** The closed polylines of a review DXF, in file order: cut then sew, per piece. */
function polylines(text: string): Poly[] {
  return parseDxf(text)
    .entities.filter((e) => e.type === "POLYLINE")
    .map((e) => ({ layer: e.layer, pts: e.vertices.map((v): [number, number] => [v[0], v[1]]) }));
}

const closedLength = (pts: Pts) => len([...pts, pts[0]]);
const box = (pts: Pts) => ({
  x0: Math.min(...pts.map((p) => p[0])),
  x1: Math.max(...pts.map((p) => p[0])),
  y0: Math.min(...pts.map((p) => p[1])),
  y1: Math.max(...pts.map((p) => p[1])),
});
const spreadAt = (pts: Pts, pick: (p: [number, number]) => number, value: number): number => {
  const row = pts.filter((p) => Math.abs(pick(p) - value) < 1e-6).map((p) => p[0]);
  return Math.max(...row) - Math.min(...row);
};

/**
 * Every point of measure read back out of a review DXF's sew lines, knowing nothing but the file:
 * the sew line IS the seam the POM table measures. Positions are translation-free (spreads and
 * drops from the high shoulder point), so where the sheet places a piece does not matter. The DXF
 * frame has y up, so the high shoulder point is the top row of the body.
 */
function measurePoms(text: string): Record<string, number> {
  const [, front, , back, , sleeve, , rib] = polylines(text);
  const fb = box(front.pts);
  const sb = box(sleeve.pts);
  const hps = fb.y1;
  const centreX = (fb.x0 + fb.x1) / 2;
  const widest = Math.max(...front.pts.map((p) => Math.abs(p[0] - centreX)));
  const dropTo = (keep: (p: [number, number]) => boolean) => hps - Math.max(...front.pts.filter(keep).map((p) => p[1]));
  return {
    A: fb.x1 - fb.x0,
    B: fb.y1 - fb.y0,
    C: spreadAt(front.pts, (p) => p[1], hps - ARTICLE.draft_constants.shoulder_slope),
    D: sb.y1 - sb.y0,
    E: (sb.x1 - sb.x0) / 2,
    F: spreadAt(sleeve.pts, (p) => p[1], sb.y0) / 2,
    G: dropTo((p) => Math.abs(Math.abs(p[0] - centreX) - widest) < 1e-6),
    H: spreadAt(front.pts, (p) => p[1], hps),
    I: dropTo((p) => Math.abs(p[0] - centreX) < 1e-6),
    K: box(back.pts).x1 - box(back.pts).x0,
    L: (box(rib.pts).y1 - box(rib.pts).y0) / 2,
  };
}

const POM_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L"];

describe("the committed article data", () => {
  it("is the same as docs/spec/articles/JSY-SS-01/article.json", () => {
    const bundled = JSON.parse(readFileSync(join(__dirname, "data/JSY-SS-01.json"), "utf8"));
    expect(bundled).toEqual(ARTICLE);
    expect(BUNDLED_ARTICLES.get("JSY-SS-01")?.sizes).toEqual(SIZES);
  });
});

/** The indexes of the parts, split at `marker`, where two files differ. */
function differingParts(mine: string, theirs: string, marker: string): number[] {
  const a = mine.split(marker);
  const b = theirs.split(marker);
  expect(a.length).toBe(b.length);
  return a.flatMap((part, i) => (part === b[i] ? [] : [i]));
}

/** Distance from p to the closed polyline. */
function distanceTo(p: [number, number], pts: Pts): number {
  let best = Infinity;
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  });
  return best;
}

/**
 * The reference XS back has a loop of about 0.06 mm at each underarm, where the offset armhole
 * overshoots itself. The port cuts those loops off (loops.ts), so the XS back cut line is the
 * one part of the reference files that is not byte for byte the same. The third polyline of a
 * review DXF is the back cut line, so its part index after the header is 3.
 */
const XS_BACK_CUT = { dxf: [3], svg: [4], nest: [8] };

describe.each(SIZES)("size %s against the reference files", (size) => {
  const mineText = files[`JSY-SS-01_${size}.dxf`];
  const theirsText = golden(`JSY-SS-01_${size}.dxf`);

  it("has every cut and sew outline within 0.5 mm of the reference, in length and at every point", () => {
    const mine = polylines(mineText);
    const theirs = polylines(theirsText);
    expect(mine.map((p) => p.layer)).toEqual(["1", "14", "1", "14", "1", "14", "1", "14"]);
    expect(theirs.map((p) => p.layer)).toEqual(mine.map((p) => p.layer));
    mine.forEach((poly, i) => {
      expect(Math.abs(closedLength(poly.pts) - closedLength(theirs[i].pts))).toBeLessThan(0.5);
      for (const p of poly.pts) expect(distanceTo(p, theirs[i].pts)).toBeLessThan(0.5);
      for (const p of theirs[i].pts) expect(distanceTo(p, poly.pts)).toBeLessThan(0.5);
    });
  });

  it("measures back to the POM table of article.json, as the committed DXF does", () => {
    const wanted = Object.fromEntries(POM_LETTERS.map((l) => [l, pom(l, size)]));
    const round = (m: Record<string, number>) => Object.fromEntries(POM_LETTERS.map((l) => [l, Math.round(m[l] * 10) / 10]));
    expect(round(measurePoms(theirsText))).toEqual(wanted);
    expect(round(measurePoms(mineText))).toEqual(wanted);
  });

  it("builds every POM into the pattern within 0.5 mm", () => {
    for (const check of drafted(size).checks) expect(Math.abs(check.actual - check.target)).toBeLessThan(0.5);
  });

  it("writes the same DXF and SVG bytes as the reference script", () => {
    const expected = size === "XS" ? XS_BACK_CUT : { dxf: [], svg: [] };
    expect(differingParts(mineText, theirsText, "0\nPOLYLINE\n")).toEqual(expected.dxf);
    expect(differingParts(files[`JSY-SS-01_${size}.svg`], golden(`JSY-SS-01_${size}.svg`), "<path ")).toEqual(expected.svg);
  });
});

describe("the one place the port leaves the reference", () => {
  it("cuts off the two tiny underarm loops of the reference XS back cut line, and nothing else", () => {
    const looped = SIZES.flatMap((size) =>
      polylines(golden(`JSY-SS-01_${size}.dxf`)).flatMap((poly, i) => {
        const crossings = selfIntersections(poly.pts);
        return crossings.length === 0 ? [] : [{ size, polyline: i, crossings: crossings.length }];
      }),
    );
    expect(looped).toEqual([{ size: "XS", polyline: 2, crossings: 2 }]);
    // Each loop is far smaller than the 0.5 mm the golden comparison allows.
    const [reference] = polylines(golden("JSY-SS-01_XS.dxf")).slice(2, 3);
    const ours = polylines(files["JSY-SS-01_XS.dxf"])[2];
    expect(selfIntersections(ours.pts)).toEqual([]);
    expect(reference.pts.length - ours.pts.length).toBe(2);
    expect(Math.abs(closedLength(reference.pts) - closedLength(ours.pts))).toBeLessThan(0.2);
  });
});

describe("the graded nest and the report", () => {
  it("writes the same nest SVG as the reference script", () => {
    expect(differingParts(files["JSY-SS-01_nest.svg"], golden("JSY-SS-01_nest.svg"), "<path ")).toEqual(XS_BACK_CUT.nest);
  });

  it("reproduces every row of pattern-report.md", () => {
    const rows = (text: string) => text.split("\n").filter((l) => l.startsWith("|") || l.startsWith("Sleeve cap ease") || l.startsWith("#"));
    expect(rows(files["pattern-report.md"])).toEqual(rows(golden("pattern-report.md")));
  });

  it("keeps the cap within the 0 to 6 mm ease and the rib at 0.85 of the neckline, every size", () => {
    for (const size of SIZES) {
      const lengths = Object.fromEntries(drafted(size).lengths.map((l) => [l.label, l.mm]));
      expect(lengths["Total ease, cap vs armhole"]).toBeGreaterThanOrEqual(0);
      expect(lengths["Total ease, cap vs armhole"]).toBeLessThanOrEqual(6);
      expect(lengths["Rib length (finished seam line)"]).toBe(Math.round(lengths["Neckline seam (full)"] * 0.85));
    }
  });
});
