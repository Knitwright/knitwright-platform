import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { reencodeEmbedded, previewSize, renderPreview } from "./embed";
import { vectorModelSchema, type PathNode, type VectorNode } from "./model";
import { parseSvg } from "./parse";
import { modelToSvg } from "./to-svg";

const text = (value: string) => new TextEncoder().encode(value);
const parse = (source: string) => parseSvg(text(source), reencodeEmbedded);
const wrap = (inner: string, attrs = 'viewBox="0 0 100 100"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${attrs}>${inner}</svg>`;

const paths = (nodes: readonly VectorNode[]): PathNode[] =>
  nodes.flatMap((node) => (node.kind === "path" ? [node] : node.kind === "group" ? paths(node.children) : []));

const CREST = wrap(
  `<defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff0000"/><stop offset="100%" style="stop-color:#0000ff;stop-opacity:.5"/></linearGradient></defs>
   <path d="M10 10 H90 V90 H10 Z" fill="url(#fade)" stroke="#102030" stroke-width="4" stroke-linejoin="round"/>
   <circle cx="50" cy="50" r="20" fill="rgb(255, 255, 255)" fill-opacity="0.5"/>`,
  'viewBox="0 0 100 100" width="90mm" height="90mm"',
);

describe("parseSvg on a clean logo", () => {
  it("becomes a model that checks against the schema, with gradients, strokes and shapes as paths", async () => {
    const { model, warnings } = await parse(CREST);
    expect(vectorModelSchema.safeParse(model).success).toBe(true);
    expect(warnings).toEqual([]);
    expect(model.statedSizeMm?.width).toBeCloseTo(90, 6);
    const [square, circle] = paths(model.nodes);
    expect(square.fill).toEqual({ type: "gradient", gradientId: "g1", opacity: 1 });
    expect(square.stroke).toEqual({ type: "colour", hex: "#102030", opacity: 1 });
    expect(square.lineJoin).toBe("round");
    expect(circle.fill).toEqual({ type: "colour", hex: "#ffffff", opacity: 0.5 });
    expect(model.gradients[0].stops.map((stop) => [stop.offset, stop.hex, stop.opacity])).toEqual([[0, "#ff0000", 1], [1, "#0000ff", 0.5]]);
  });

  it("gives the same JSON for the same file, so a hash can stand for it", async () => {
    expect(JSON.stringify((await parse(CREST)).model)).toBe(JSON.stringify((await parse(CREST)).model));
  });

  it("holds no SVG, script or link text anywhere in the stored JSON", async () => {
    const json = JSON.stringify((await parse(CREST)).model);
    expect(json).not.toMatch(/<|javascript|href|xlink|onload/i);
  });

  it("does not call a size in pixels a measurement", async () => {
    const { model } = await parse(wrap('<rect width="10" height="10"/>', 'width="300" height="200"'));
    expect(model.statedSizeMm).toBeNull();
    expect(model.viewBox).toEqual({ x: 0, y: 0, width: 300, height: 200 });
  });

  it("reads real units as millimetres", async () => {
    const { model } = await parse(wrap('<rect width="10" height="10"/>', 'viewBox="0 0 10 10" width="1in" height="2cm"'));
    expect(model.statedSizeMm?.width).toBeCloseTo(25.4, 6);
    expect(model.statedSizeMm?.height).toBeCloseTo(20, 6);
  });
});

describe("styles", () => {
  it("applies a class from a style sheet, then the attribute, then the element's own style", async () => {
    const source = wrap(
      '<style><![CDATA[.a{fill:#ff0000;stroke:#00ff00;stroke-width:2} .b,.c{fill:blue}]]></style><rect class="a" width="10" height="10" fill="#111111"/><rect class="b" width="5" height="5" style="stroke:#000"/>',
    );
    const [one, two] = paths((await parse(source)).model.nodes);
    expect(one.fill).toMatchObject({ hex: "#ff0000" });
    expect(one.stroke).toMatchObject({ hex: "#00ff00" });
    expect(two.fill).toMatchObject({ hex: "#0000ff" });
    expect(two.stroke).toMatchObject({ hex: "#000000" });
  });

  it("inherits fill from a group and honours currentColor, display none and opacity", async () => {
    const source = wrap(
      '<g fill="#abcdef" color="#123456" opacity=".5"><rect width="1" height="1"/><rect width="1" height="1" fill="currentColor"/><rect width="1" height="1" display="none"/></g>',
    );
    const { model } = await parse(source);
    const group = model.nodes[0];
    expect(group.kind).toBe("group");
    expect(group.kind === "group" && group.opacity).toBe(0.5);
    expect(paths(model.nodes).map((node) => (node.fill.type === "colour" ? node.fill.hex : ""))).toEqual(["#abcdef", "#123456"]);
  });

  it("says when style rules were not understood, and drops a colour it does not know", async () => {
    const odd = wrap('<style>@media print{.a{fill:red}} g > rect{fill:red}</style><rect width="1" height="1" fill="notacolour"/>');
    const { warnings, model } = await parse(odd);
    expect(warnings).toContain("Some style rules in the file were not understood and were left out.");
    expect(warnings).toContain("A colour in the file was not recognised and was left out.");
    expect(paths(model.nodes)[0].fill).toEqual({ type: "none" });
  });

  it("reads colours in short hex, hsl and with alpha", async () => {
    const source = wrap(
      '<rect width="1" height="1" fill="#f00"/><rect width="1" height="1" fill="#00ff0080"/><rect width="1" height="1" fill="hsl(240, 100%, 50%)"/><rect width="1" height="1" fill="rgba(0,0,0,.25)"/><rect width="1" height="1" fill="rgb(100%,0%,0%)"/><rect width="1" height="1" fill="transparent"/><rect width="1" height="1" fill="Navy"/>',
    );
    const fills = paths((await parse(source)).model.nodes).map((node) => (node.fill.type === "colour" ? `${node.fill.hex}/${node.fill.opacity}` : "none"));
    expect(fills).toEqual(["#ff0000/1", "#00ff00/0.502", "#0000ff/1", "#000000/0.25", "#ff0000/1", "#000000/0", "#000080/1"]);
  });
});

describe("structure", () => {
  it("expands a use of something inside the file, with its offset", async () => {
    const source = wrap('<defs><path id="p" d="M0 0 L5 0 L5 5 Z"/></defs><use href="#p" x="10" y="20" fill="#336699"/>');
    const { model } = await parse(source);
    const group = model.nodes[0];
    expect(group.kind === "group" && group.transform).toEqual([1, 0, 0, 1, 10, 20]);
    expect(paths(model.nodes)[0].fill).toMatchObject({ hex: "#336699" });
  });

  it("applies transforms and keeps a clip path", async () => {
    const source = wrap(
      '<clipPath id="k"><rect width="20" height="20"/></clipPath><g clip-path="url(#k)" transform="translate(5 5) scale(2) rotate(90) skewX(10) matrix(1 0 0 1 0 0)"><circle r="4" cx="9" cy="9"/></g>',
    );
    const { model } = await parse(source);
    expect(model.clips).toHaveLength(1);
    const group = model.nodes[0];
    expect(group.kind === "group" && group.clipId).toBe("c1");
    expect(group.kind === "group" && group.transform?.length).toBe(6);
  });

  it("warns that text and effects were left out, and skips editor data", async () => {
    const source = wrap(
      '<metadata><x:y xmlns:x="urn:x">data</x:y></metadata><sodipodi:namedview xmlns:sodipodi="urn:s"/><text x="1" y="2">Club</text><filter id="f"/><rect width="5" height="5"/>',
    );
    const { warnings, model } = await parse(source);
    expect(warnings).toContain("Text in the file was left out. Convert text to outlines for an exact match.");
    expect(warnings).toContain("Effects in the file (filters, masks, patterns or markers) were left out.");
    expect(paths(model.nodes)).toHaveLength(1);
  });

  it("keeps the part of a path before a mistake and says so", async () => {
    const { model, warnings } = await parse(wrap('<path d="M0 0 L10 0 L10 10 Q"/>'));
    expect(paths(model.nodes)[0].segments).toHaveLength(3);
    expect(warnings).toContain("A path in the file had an error, so only the part before it was kept.");
  });

  it("refuses a file with nothing to draw", async () => {
    await expect(parse(wrap('<defs/><rect width="0" height="5"/>'))).rejects.toThrow(/nothing to draw/);
    await expect(parse('<svg xmlns="http://www.w3.org/2000/svg"><rect width="5" height="5"/></svg>')).rejects.toThrow(/nothing to draw/);
  });

  it("covers every basic shape", async () => {
    const source = wrap(
      '<rect x="1" y="1" width="10" height="8" rx="2"/><rect width="4" height="4"/><ellipse cx="5" cy="5" rx="3" ry="2"/><line x1="0" y1="0" x2="9" y2="9" stroke="#000"/><polyline points="0,0 5,5 9,0" stroke="#000" fill="none"/><polygon points="0,0 5,5 9,0"/><circle r="0"/><polygon points="1,1"/>',
    );
    expect(paths((await parse(source)).model.nodes)).toHaveLength(6);
  });
});

describe("path data", () => {
  it("turns relative commands, smooth curves and arcs into absolute lines and curves", async () => {
    const d = "m10 10 h20 v20 h-20 z m5 5 l1 1 c1 1 2 2 3 3 s1 1 2 2 q1 1 2 2 t3 3 a5 5 0 0 1 10 0 A5 5 0 1 0 0 0 M1,1 2,2";
    const [node] = paths((await parse(wrap(`<path d="${d}"/>`))).model.nodes);
    const ops = node.segments.map((segment) => segment[0]);
    expect(ops.slice(0, 6)).toEqual(["M", "L", "L", "L", "Z", "M"]);
    expect(ops.every((op) => ["M", "L", "C", "Q", "Z"].includes(op))).toBe(true);
    expect(node.segments[1]).toEqual(["L", 30, 10]);
    // After the close, a relative move starts from the start of the closed shape.
    expect(node.segments[5]).toEqual(["M", 15, 15]);
  });
});

describe("embedded pictures", () => {
  it("are read again as pixels and kept as a clean PNG", async () => {
    const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#2b46f0" } }).jpeg().toBuffer();
    const source = wrap(`<image x="1" y="2" width="30" height="30" href="data:image/jpeg;base64,${jpeg.toString("base64")}"/>`);
    const { model } = await parse(source);
    const image = model.nodes[0];
    expect(image.kind).toBe("image");
    const png = Buffer.from(image.kind === "image" ? image.png : "", "base64");
    expect((await sharp(png).metadata()).format).toBe("png");
  });

  it("are dropped when they are not really pictures", async () => {
    const source = wrap('<image width="9" height="9" href="data:image/png;base64,bm90IGEgcGljdHVyZQ=="/><rect width="1" height="1"/>');
    expect((await parse(source)).model.nodes).toHaveLength(1);
    expect(await reencodeEmbedded(new Uint8Array(0))).toBeNull();
    const gif = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).gif().toBuffer();
    expect(await reencodeEmbedded(gif)).toBeNull();
  });
});

describe("the screen picture", () => {
  it("renders the model to a PNG within the screen size, and the SVG text holds nothing but plain drawing", async () => {
    const { model } = await parse(CREST);
    const { png, widthPx, heightPx } = await renderPreview(model);
    expect(previewSize(model)).toEqual({ widthPx: 2048, heightPx: 2048 });
    const meta = await sharp(png).metadata();
    expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual(["png", widthPx, heightPx, true]);
    const svg = modelToSvg(model, { widthPx: 10, heightPx: 10 });
    expect(svg).not.toMatch(/<script|on\w+=|javascript/i);
    const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    expect(data.some((byte) => byte !== 0)).toBe(true);
  });

  it("draws gradients, clips, images, groups and evenodd paths", async () => {
    const jpeg = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).png().toBuffer();
    const source = wrap(
      `<defs><radialGradient id="r"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient><clipPath id="k"><rect width="50" height="50"/></clipPath></defs>
       <g opacity=".5" clip-path="url(#k)" transform="translate(1 1)"><path d="M0 0 H40 V40 H0 Z M10 10 H30 V30 H10 Z" fill-rule="evenodd" fill="url(#r)" stroke="red" stroke-width="3"/></g>
       <image width="10" height="10" opacity=".5" href="data:image/png;base64,${jpeg.toString("base64")}"/>`,
    );
    const { model } = await parse(source);
    const svg = modelToSvg(model, { widthPx: 100, heightPx: 100 });
    expect(svg).toContain("radialGradient");
    expect(svg).toContain("clipPath");
    expect(svg).toContain('fill-rule="evenodd"');
    const { png } = await renderPreview(model);
    expect((await sharp(png).metadata()).width).toBe(2048);
  });
});
