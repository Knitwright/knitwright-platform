import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  CLEAN_LOGO, ENTITY_BOMB, svgOf, TINY_PNG_DATA, USE_BOMB, WITH_CSS_IMPORT, WITH_EMBEDDED_PNG, WITH_EXTERNAL_HREF, WITH_FOREIGN_OBJECT, WITH_ONLOAD, WITH_SCRIPT, WITH_USE_EXTERNAL,
} from "../fixtures/svgs";
import { intakeVector, vectorDocSchema, vectorToSvg } from "./index";
import { REFUSALS } from "./refuse";
import { TEXT_OMITTED } from "./svg";

const intake = (text: string) => intakeVector(new TextEncoder().encode(text), "svg");

describe("a clean SVG", () => {
  it("becomes restricted vector JSON and a preview, with the size and text noted", async () => {
    const result = await intake(CLEAN_LOGO);
    expect(vectorDocSchema.safeParse(JSON.parse(result.json.toString("utf8"))).success).toBe(true);
    expect(result.doc).toMatchObject({ source: "svg", viewBox: { x: 0, y: 0, width: 100, height: 50 }, textOmitted: true });
    expect(result.doc.naturalWidthMm).toBeCloseTo(26.458, 2);
    expect(result.warnings).toContain(TEXT_OMITTED);
    expect([result.widthPx, result.heightPx]).toEqual([100, 50]);
    const preview = await sharp(result.preview).metadata();
    expect(preview).toMatchObject({ format: "png", width: 1600, height: 800, hasAlpha: true });
  });

  it("holds nothing but the allowed kinds of node, and no markup at all", async () => {
    const { doc, json } = await intake(CLEAN_LOGO);
    const kinds = new Set<string>();
    const walk = (nodes: readonly { t: string; children?: readonly unknown[] }[]): void =>
      nodes.forEach((node) => {
        kinds.add(node.t);
        walk((node.children ?? []) as never);
      });
    walk(doc.nodes);
    expect([...kinds].sort()).toEqual(["g", "path"]);
    expect(json.toString("utf8")).not.toMatch(/<|script|href|onload|javascript/i);
  });

  it("applies the style sheet, gradients, clips, uses and transforms", async () => {
    const { doc } = await intake(CLEAN_LOGO);
    const text = JSON.stringify(doc);
    expect(text).toContain('"hex":"#cc0000"');
    expect(doc.gradients).toHaveLength(1);
    expect(doc.gradients[0]).toMatchObject({ type: "linear", stops: [{ offset: 0, hex: "#ffffff", opacity: 1 }, { offset: 1, hex: "#0044cc", opacity: 0.5 }] });
    expect(doc.clips).toHaveLength(1);
    const svg = vectorToSvg(doc, 200);
    expect(svg).toContain('width="200"');
    expect(svg).toContain("clip-path=");
    expect(svg).toContain('fill="url(#g1)"');
    expect(svg).toContain('stroke="#003366"');
    // The use of the dot sits at (80,30) scaled by 1.5 and takes the use element's fill.
    expect(svg).toContain('fill="#ffa500"');
  });

  it("draws what it says: red pixels where the red rectangle is", async () => {
    const { preview } = await intake(CLEAN_LOGO);
    const { data, info } = await sharp(preview).raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 4)];
    // The rectangle spans 5..35 x 5..25 of a 100 x 50 box, drawn 16 times larger.
    expect(at(16 * 20, 16 * 15)).toEqual([204, 0, 0, 255]);
    expect(at(16 * 60, 16 * 40)[3]).toBe(0);
  });
});

describe("a hostile SVG", () => {
  it.each([
    ["a script", WITH_SCRIPT, REFUSALS.script],
    ["an onload attribute", WITH_ONLOAD, /event handler \(onload\)/],
    ["an external image", WITH_EXTERNAL_HREF, REFUSALS.external],
    ["a use that points outside the file", WITH_USE_EXTERNAL, REFUSALS.external],
    ["a foreignObject", WITH_FOREIGN_OBJECT, REFUSALS.foreignObject],
    ["a CSS import", WITH_CSS_IMPORT, REFUSALS.external],
    ["an entity bomb", ENTITY_BOMB, REFUSALS.entities],
  ])("is refused with a sentence: %s", async (_name, file, expected) => {
    await expect(intake(file)).rejects.toThrow(expected);
  });

  it("is stopped when uses nest into a hundred million shapes", async () => {
    await expect(intake(USE_BOMB)).rejects.toThrow(REFUSALS.tooComplex);
  });

  it("is refused when it is too big, or has too many path points", async () => {
    await expect(intakeVector(new Uint8Array(6 * 1024 * 1024).fill(32), "svg")).rejects.toThrow(/too large/);
    const points = Array.from({ length: 250_000 }, (_, i) => `L${i % 90} ${i % 40}`).join("");
    await expect(intake(svgOf(`<path d="M0 0${points}"/>`))).rejects.toThrow(REFUSALS.tooComplex);
  });

  it("is refused when it is not an SVG, has no size, or draws nothing", async () => {
    await expect(intake("<html/>")).rejects.toThrow(REFUSALS.notSvg);
    await expect(intake(svgOf("<rect width='5' height='5'/>", ""))).rejects.toThrow(REFUSALS.empty);
    await expect(intake(svgOf("<g/>"))).rejects.toThrow(REFUSALS.empty);
    await expect(intake(svgOf("<text>Only words</text>"))).rejects.toThrow(/Convert text to outlines/);
  });
});

describe("what is left out is said", () => {
  it("notes effects, patterns, unknown parts, bad transforms and unreadable style rules", async () => {
    const file = svgOf(`
      <style>g > rect { fill: red }</style>
      <pattern id="p" width="2" height="2"><rect width="1" height="1"/></pattern>
      <rect width="10" height="10" fill="url(#p)" stroke="blue" filter="url(#blur)"/>
      <bogus/>
      <circle cx="5" cy="5" r="3" transform="spin(3)"/>`);
    const { warnings } = await intake(file);
    expect(warnings).toEqual(expect.arrayContaining([
      "Effects such as blurs and masks were left out.",
      "A pattern fill was left out.",
      "Some parts of this file use features that cannot be printed and were left out.",
      "A transform in this file could not be read and was ignored.",
    ]));
  });
});

describe("shapes and paint", () => {
  const shapes = (inner: string) => intake(svgOf(inner)).then((r) => r.doc);

  it("skips what is hidden, empty or unpainted", async () => {
    const doc = await shapes(`
      <rect width="10" height="10" display="none"/>
      <rect width="10" height="10" visibility="hidden"/>
      <rect width="0" height="10"/>
      <circle r="0"/>
      <ellipse rx="0" ry="2"/>
      <rect width="5" height="5" fill="none"/>
      <path d="M0 0 L10 10 @"/>
      <polyline points="1"/>
      <rect id="shown" width="5" height="5"/>`);
    expect(doc.nodes).toHaveLength(1);
  });

  it("reads lines, polylines, dashes, caps and opacity on strokes", async () => {
    const doc = await shapes(
      `<line x1="0" y1="0" x2="10" y2="10" stroke="red" stroke-width="2" stroke-dasharray="3 1" stroke-linecap="round" stroke-linejoin="bevel" stroke-opacity=".5" stroke-miterlimit="2"/>
       <polyline points="0,0 5,5 10,0" stroke="#00f" fill="none"/>`,
    );
    const first = doc.nodes[0];
    expect(first).toMatchObject({ t: "path", stroke: { width: 2, dash: [3, 1], cap: "round", join: "bevel", opacity: 0.5, miterLimit: 2 } });
  });

  it("makes a radial gradient in user space, follows href for stops, and keeps stroke gradients", async () => {
    const doc = await shapes(`
      <defs>
        <linearGradient id="base"><stop offset="0" style="stop-color:red"/><stop offset="50%" stop-color="blue"/></linearGradient>
        <radialGradient id="rad" href="#base" gradientUnits="userSpaceOnUse" cx="50" cy="25" r="20" gradientTransform="translate(1 1)"/>
      </defs>
      <rect width="100" height="50" fill="url(#rad)" stroke="url(#base)" stroke-width="2"/>`);
    expect(doc.gradients.map((g) => g.type).sort()).toEqual(["linear", "radial"]);
    const radial = doc.gradients.find((g) => g.type === "radial");
    expect(radial).toMatchObject({ cx: 50, cy: 25, r: 20, fx: 50, fy: 25, m: [1, 0, 0, 1, 1, 1] });
    expect(radial?.stops).toHaveLength(2);
  });

  it("drops a gradient with no stops or an unknown reference, falling back to the next paint", async () => {
    const doc = await shapes(`
      <linearGradient id="empty"/>
      <rect width="10" height="10" fill="url(#empty)"/>
      <rect width="10" height="10" fill="url(#missing) green"/>`);
    expect(doc.nodes).toHaveLength(1);
    expect(JSON.stringify(doc.nodes[0])).toContain("#008000");
  });

  it("does not follow a use that loops or goes too deep", async () => {
    const doc = await shapes(`<g id="a"><use href="#a"/><rect width="5" height="5"/></g><use href="#a"/><use href="#nothing"/>`);
    expect(doc.warnings).toContain("Some parts of this file use features that cannot be printed and were left out.");
    expect(doc.nodes.length).toBeGreaterThan(0);
  });

  it("uses a nested svg and a symbol as groups", async () => {
    const doc = await shapes(`<symbol id="s"><rect width="5" height="5"/></symbol><svg x="10" y="10"><use href="#s"/></svg>`);
    expect(JSON.stringify(doc.nodes)).toContain('"m":[1,0,0,1,10,10]');
  });

  it("ignores a clip path that uses bounding box units and one that does not exist", async () => {
    const doc = await shapes(`
      <clipPath id="b" clipPathUnits="objectBoundingBox"><rect width="1" height="1"/></clipPath>
      <rect width="10" height="10" clip-path="url(#b)"/>
      <rect width="10" height="10" clip-path="url(#none)"/>`);
    expect(doc.clips).toEqual([]);
    expect(doc.warnings.length).toBeGreaterThan(0);
  });

  it("flattens a clip path that has its own transform and a group", async () => {
    const doc = await shapes(`
      <clipPath id="c" transform="translate(5 5)"><g><rect width="10" height="10"/></g><use href="#r"/></clipPath>
      <rect id="r" width="2" height="2" fill="none"/>
      <rect width="20" height="20" clip-path="url(#c)"/>`);
    const svg = vectorToSvg(doc);
    expect(svg).toMatch(/<clipPath id="c1"><path d="[^"]+" clip-rule="nonzero" transform="matrix\(1 0 0 1 5 5\)"\/>/);
  });
});

describe("embedded pictures", () => {
  it("are read again as pixels and fitted inside their box", async () => {
    const { doc } = await intake(WITH_EMBEDDED_PNG);
    const image = doc.nodes.find((node) => node.t === "image");
    expect(image).toMatchObject({ t: "image", x: 20, y: 10, width: 20, height: 20 });
    expect(image?.t === "image" && image.png).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect((await sharp(Buffer.from((image as { png: string }).png, "base64")).metadata()).format).toBe("png");
  });

  it("are refused when they are not PNG or JPEG, or are too many", async () => {
    const gif = Buffer.from("R0lGODlhAQABAAAAACw=", "base64").toString("base64");
    await expect(intake(svgOf(`<image width="1" height="1" href="data:image/png;base64,${gif}"/>`))).rejects.toThrow();
    const many = Array.from({ length: 9 }, () => `<image width="1" height="1" href="data:image/png;base64,${TINY_PNG_DATA}"/>`).join("");
    await expect(intake(svgOf(many))).rejects.toThrow(REFUSALS.tooComplex);
  });

  it("use the picture's own size when no size is given", async () => {
    const { doc } = await intake(svgOf(`<image href="data:image/png;base64,${TINY_PNG_DATA}"/>`));
    expect(doc.nodes[0]).toMatchObject({ t: "image", width: 1, height: 1 });
  });
});
