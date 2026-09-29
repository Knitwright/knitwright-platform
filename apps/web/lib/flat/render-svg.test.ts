import { describe, expect, it } from "vitest";
import type { Artwork, GarmentSpec } from "@/lib/garment";
import { buildFlat } from "./build";
import { designWith, madeUpValues, typedIn } from "./fixtures/designs";
import type { FlatModel, FlatPath } from "./model";
import { escapeXml, renderSvg, svgDataUri } from "./render-svg";

const FILE_ID = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

const artwork = (patch: Partial<Artwork>): Artwork => ({
  id: "a1",
  name: "Logo",
  source: { kind: "file", fileId: FILE_ID },
  panelId: "body-front",
  anchor: "centre-chest",
  offsetX: 0,
  offsetY: 0,
  width: 600,
  height: 400,
  rotationDegrees: 30,
  technique: "screen-print",
  provenance: "user-edited",
  ...patch,
});

const modelWith = (items: readonly Artwork[], callouts = false): FlatModel => {
  const base = designWith("crew-tee", {}, madeUpValues({}));
  const spec: GarmentSpec = { ...base, artwork: items };
  const model = buildFlat({ spec, measurements: typedIn(spec), view: "front", colourwayId: "main", callouts });
  if (!model) throw new Error("No drawing");
  return model;
};

const count = (text: string, pattern: RegExp): number => (text.match(pattern) ?? []).length;

describe("escapeXml", () => {
  it("escapes the five characters that matter and drops characters XML cannot hold", () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;");
    expect(escapeXml("a\u0000b\u0008c\u001fd")).toBe("abcd");
    expect(escapeXml("café \u{1F600}")).toBe("café \u{1F600}");
  });
});

describe("renderSvg structure", () => {
  const model = modelWith([]);
  const svg = renderSvg(model);

  it("is an svg whose viewBox is in the model's units and whose size is in real millimetres", () => {
    const { minX, minY, maxX, maxY } = model.bounds;
    const width = maxX - minX;
    const height = maxY - minY;
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain(`viewBox="${minX} ${minY} ${width} ${height}"`);
    expect(svg).toContain(`width="${width / 10}mm"`);
    expect(svg).toContain(`height="${height / 10}mm"`);
    expect(width / 10 / width).toBeCloseTo(height / 10 / height, 12);
  });

  it("has one named group per layer, in drawing order, that drawing tools open as layers", () => {
    const groups = [...svg.matchAll(/<g id="layer-([a-z]+)" inkscape:groupmode="layer" inkscape:label="([^"]+)">/g)];
    expect(groups.map((match) => match[1])).toEqual(["panels", "seams", "stitching", "details", "artwork"]);
    expect(groups.map((match) => match[2])).toEqual(["Panels", "Seams", "Stitching", "Details", "Artwork"]);
    expect(svg).toContain('xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"');
  });

  it("carries the description as a title, for people who cannot see the picture", () => {
    expect(svg).toContain(`<title>${escapeXml(model.description)}</title>`);
    expect(svg).toContain('role="img"');
  });

  it("has no scripts, no event attributes and no reference to anything outside the file", () => {
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
    expect(svg).not.toMatch(/href\s*=\s*"(?!data:image\/(png|jpeg);base64,)/i);
    expect(svg).not.toMatch(/url\(/i);
    expect(svg).not.toMatch(/<(foreignObject|use|iframe|style)/i);
  });

  it("draws every path as a path with its fill, stroke and dashes", () => {
    const paths = model.layers.flatMap((layer) => layer.elements).filter((element): element is FlatPath => element.kind === "path");
    expect(count(svg, /<path /g)).toBe(paths.length);
    expect(svg).toContain('stroke-dasharray="16 10"');
    expect(svg).toMatch(/<path [^>]*fill="#e5e7eb"/);
    expect(svg).toMatch(/ d="M [-\d.]+ [-\d.]+ L /);
    expect(svg).toMatch(/ C [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+/);
    expect(svg).toMatch(/ Z"/);
  });
});

describe("renderSvg artwork", () => {
  it("embeds an image as a data URI from bytes the caller already has, and never fetches", () => {
    const svg = renderSvg(modelWith([artwork({})]), new Map([[FILE_ID, { bytes: PNG_BYTES, contentType: "image/png" as const }]]));
    expect(svg).toContain(`href="data:image/png;base64,${Buffer.from(PNG_BYTES).toString("base64")}"`);
    expect(count(svg, /<image /g)).toBe(1);
    expect(svg).toContain('transform="rotate(30 ');
  });

  it("draws a dashed box where a picture whose bytes were not given belongs, and writes no empty image", () => {
    const svg = renderSvg(modelWith([artwork({})]));
    expect(count(svg, /<image/g)).toBe(0);
    expect(svg).not.toContain("base64");
    expect(svg).toMatch(/<path [^>]*stroke-dasharray="16 10"[^>]*data-name="Missing picture"/);
  });

  it("places a picture that is wider than it is tall by its centre, size and turn", () => {
    const wide = modelWith([artwork({ width: 800, height: 200, rotationDegrees: 0, offsetX: 0, offsetY: 0 })]);
    const element = wide.layers.find((layer) => layer.id === "artwork")?.elements[0];
    if (element?.kind !== "image") throw new Error("Expected a picture");
    const svg = renderSvg(wide, new Map([[FILE_ID, { bytes: PNG_BYTES, contentType: "image/png" as const }]]));
    expect(svg).toContain(`<image x="${element.at.x - 400}" y="${element.at.y - 100}" width="800" height="200" `);
  });

  it("does not embed a type it does not know, even if the caller says it is fine", () => {
    const hostile = new Map([[FILE_ID, { bytes: PNG_BYTES, contentType: "image/svg+xml" as never }]]);
    const svg = renderSvg(modelWith([artwork({})]), hostile);
    expect(svg).not.toContain("base64");
    expect(svg).not.toContain("svg+xml");
  });

  it("escapes text artwork completely", () => {
    const nasty = `<b>"Tom" & 'Jerry'</b></text><script>alert(1)</script>`;
    const svg = renderSvg(modelWith([artwork({ source: { kind: "text", text: nasty } })]));
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("</text><script");
    expect(svg).toContain("&lt;/text&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(svg).toContain("&lt;b&gt;&quot;Tom&quot; &amp; &apos;Jerry&apos;&lt;/b&gt;");
  });

  it("escapes the names of parts and the description", () => {
    const model = modelWith([]);
    const first = model.layers[0]?.elements[0] as FlatPath;
    const hostile: FlatModel = {
      ...model,
      description: 'x"><script>1</script>',
      layers: [{ ...model.layers[0]!, elements: [{ ...first, name: '"><script>' }, ...model.layers[0]!.elements.slice(1)] }, ...model.layers.slice(1)],
    };
    const svg = renderSvg(hostile);
    expect(svg).not.toContain("<script");
  });

  it("never writes a colour that is not #rrggbb", () => {
    const model = modelWith([]);
    const first = model.layers[0]?.elements[0] as FlatPath;
    const hostile: FlatModel = {
      ...model,
      layers: [{ ...model.layers[0]!, elements: [{ ...first, fill: 'red" onload="x' }] }],
    };
    expect(renderSvg(hostile)).not.toContain("onload");
  });
});

describe("renderSvg callouts", () => {
  it("draws callout labels as text in their own layer", () => {
    const svg = renderSvg(modelWith([], true));
    expect(svg).toContain('id="layer-measurements"');
    expect(svg).toContain(">Chest width 52.0 cm</text>");
    expect(svg).toContain('text-anchor="middle"');
  });
});

describe("svgDataUri", () => {
  it("makes an address an image tag can show, so nothing inside the drawing can run", () => {
    const uri = svgDataUri("<svg>a b #c</svg>");
    expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(uri.slice("data:image/svg+xml;charset=utf-8,".length))).toBe("<svg>a b #c</svg>");
    expect(uri).not.toContain("<");
    expect(uri).not.toContain("#");
  });
});

describe("a drawing that is not to scale", () => {
  const spec = designWith("crew-tee", {});
  const bare = buildFlat({ spec, measurements: typedIn(spec), view: "front", colourwayId: "main" }) as FlatModel;

  it("claims no physical size: a viewBox only, and a description that says so", () => {
    const svg = renderSvg(bare);
    const root = svg.slice(0, svg.indexOf(">"));
    expect(root).toContain("viewBox=");
    expect(root).not.toMatch(/\swidth=/);
    expect(root).not.toMatch(/\sheight=/);
    expect(svg).not.toMatch(/\d\s?mm"/);
    expect(svg).toContain("<desc>Not to scale. Some measurements are missing.</desc>");
  });

  it("still claims the real size when every measurement is present", () => {
    const svg = renderSvg(modelWith([]));
    expect(svg.slice(0, svg.indexOf(">"))).toMatch(/\swidth="[\d.]+mm"/);
    expect(svg).not.toContain("<desc>");
  });
});

describe("text that is not well formed", () => {
  it("does not stop the address being made, and puts a replacement mark where half a pair was", () => {
    const model = modelWith([artwork({ source: { kind: "text", text: "a\uD800b\uDC00c" }, rotationDegrees: 0 })]);
    const svg = renderSvg(model);
    expect(() => svgDataUri(svg)).not.toThrow();
    expect(svg).toContain(">a�b�c</text>");
  });

  it("leaves a well formed pair alone", () => {
    expect(escapeXml("\u{1F600}")).toBe("\u{1F600}");
    expect(escapeXml("a\uD800b")).toBe("a�b");
  });
});
