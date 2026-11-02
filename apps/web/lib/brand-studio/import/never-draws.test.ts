import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE } from "../types";
import { planOf } from "./apply";
import { decideKind, tickRights } from "./decisions";
import { createStubStyleWriter, STYLE_SYSTEM, styleFrom } from "./style";
import { proposal } from "./fixtures/proposal";

/**
 * **Spec decision 13: AI never draws the garment.** A derived visual style becomes parameters and
 * words, never pixels on a panel and never a print file. Brand import is a place where that could
 * go wrong twice over — a vision model is reading pictures, and the pictures it reads are of
 * garments — so this file proves it where the code could allow it.
 *
 * It proves four things:
 *
 * 1. The writer's answer is exactly three strings. There is no field a picture could arrive in, and
 *    the parser throws away anything else the model said.
 * 2. Nothing in this directory imports the drawing, the panel layers, the print files or the
 *    garment rules, so there is no path from an import to a panel or to a file a factory prints.
 * 3. An accepted picture becomes one of the brand's own uploads and a brand picture — never a
 *    design layer. The plan an import produces can hold nothing else.
 * 4. The instructions sent to the model forbid describing the garment at all.
 */

const DIR = join(__dirname);
const SOURCES = readdirSync(DIR, { withFileTypes: true, recursive: true })
  .filter((entry) => entry.isFile() && /\.ts$/.test(entry.name) && !/\.test\./.test(entry.name))
  .map((entry) => join(entry.parentPath, entry.name));

const importsOf = (path: string): string[] =>
  [...readFileSync(path, "utf8").matchAll(/^(?:import|export)[^;]*?from\s+"([^"]+)"/gm)].map((match) => match[1] ?? "");

describe("the writer's answer", () => {
  it("is three strings and nothing else, whatever the model said", async () => {
    const written = await createStubStyleWriter().write({ brandName: "Ravensmoor", host: "ravensmoor.test", title: null, facts: [] });
    expect(Object.keys(written).sort()).toEqual(["artDirection", "rulesBoundaries", "setting"]);
    expect(Object.values(written).every((text) => typeof text === "string")).toBe(true);
  });

  it("drops a picture, a layer and a print file a model tried to put in its answer", () => {
    const written = styleFrom({
      setting: "A wet pitch.",
      artDirection: "Long lens.",
      rulesBoundaries: "None.",
      image: "data:image/png;base64,AAAA",
      layers: [{ kind: "graphic", url: "https://elsewhere.test/art.png" }],
      printFile: "front.pdf",
    });
    expect(Object.keys(written).sort()).toEqual(["artDirection", "rulesBoundaries", "setting"]);
    expect(JSON.stringify(written)).not.toContain("data:image");
    expect(JSON.stringify(written)).not.toContain("printFile");
  });

  it("asks the model for words only, and forbids it describing the garment", () => {
    expect(STYLE_SYSTEM).toContain("Answer with JSON only");
    expect(STYLE_SYSTEM).toMatch(/Never describe a garment's construction, its seams, its panels or its pattern/);
    expect(STYLE_SYSTEM).toMatch(/you are describing photographs, not clothes/);
  });
});

describe("the files of this directory", () => {
  it("import nothing that draws a garment, lays out a panel or makes a print file", () => {
    const drawing = /@\/lib\/(panel-layers|print|flat|garment|kpp|design-object|repeat|media|mockups|shoots|files-service)(\/|")/;
    const offenders = SOURCES.flatMap((path) => importsOf(path).filter((module) => drawing.test(`${module}"`)).map((module) => `${path}: ${module}`));
    expect(offenders).toEqual([]);
  });

  it("import the colour arithmetic and nothing else of the production code", () => {
    const ours = SOURCES.flatMap((path) => importsOf(path)).filter((module) => module.startsWith("@/lib/"));
    expect([...new Set(ours)].sort()).toEqual([
      "@/lib/benchmarks/fetch",
      "@/lib/benchmarks/robots",
      "@/lib/colour/convert",
      "@/lib/colour/palette",
      "@/lib/consent/wording",
      // The one list of addresses that are not a public web page, which this directory used to carry
      // a second copy of (review v5, decision 0112). It reads a hostname and nothing else.
      "@/lib/http/public-url",
      "@/lib/providers/catalog",
      "@/lib/providers/text-model",
      "@/lib/server/core/guard",
      "@/lib/settings/types",
      "@/lib/usage/meter",
    ]);
  });
});

describe("what an accepted picture becomes", () => {
  const now = new Date("2026-11-02T10:00:00.000Z");

  const kept = () => tickRights((["logo", "colour", "font", "graphic", "style"] as const).reduce((one, kind) => decideKind(one, kind, "accepted"), proposal()), true);

  it("becomes one of the brand's own uploads, as a logo or a graphic, and never a design layer", () => {
    const plan = planOf(kept(), EMPTY_PROFILE, "u1", now);
    expect(plan.uploads.map((upload) => upload.assetKind).sort()).toEqual(["graphic", "logo"]);
    expect(plan.uploads.every((upload) => ["logo", "graphic"].includes(upload.assetKind))).toBe(true);
  });

  it("gives a plan that can hold a profile, a palette, fonts and uploads, and nothing else at all", () => {
    expect(Object.keys(planOf(kept(), EMPTY_PROFILE, "u1", now)).sort()).toEqual(["fonts", "palette", "profile", "uploads"]);
  });

  it("writes the three texts into the brand's own details, as words a person can edit", () => {
    const plan = planOf(kept(), EMPTY_PROFILE, "u1", now);
    expect(plan.profile?.setting).toContain("A wet pitch at dusk");
    expect(typeof plan.profile?.artDirection).toBe("string");
    expect(JSON.stringify(plan.profile)).not.toContain("data:image");
  });
});
