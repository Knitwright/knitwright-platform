import { describe, expect, it } from "vitest";
import { imageScene, rasterScene, vectorScene, wellFormed } from "./fixtures";
import { renderSvg } from "./svg";
import { renderSvgAsync } from "./svg-async";

describe("renderSvg", () => {
  it("is well formed with a page size equal to the piece plus the bleed", () => {
    const svg = renderSvg(vectorScene());
    expect(wellFormed(svg)).toBe(true);
    expect(svg).toContain('width="306.00mm"');
    expect(svg).toContain('height="206.00mm"');
    expect(svg).toContain('viewBox="0.00 0.00 306.00 206.00"');
  });

  it("flips y and moves the origin to the bleed corner", () => {
    const svg = renderSvg(vectorScene());
    // The cut line starts at (10, 20): page x 3, page y 223 - 20 = 203.
    expect(svg).toContain('d="M3.00 203.00 L303.00 203.00 L303.00 3.00 L3.00 3.00 Z"');
  });

  it("draws ground, evenodd logo, stroke, guides and margin in order", () => {
    const svg = renderSvg(vectorScene());
    expect(svg.indexOf('id="art"')).toBeLessThan(svg.indexOf('id="guides"'));
    expect(svg.indexOf('id="guides"')).toBeLessThan(svg.indexOf('id="margin"'));
    expect(svg).toContain('clip-path="url(#bleed-clip)"');
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain('stroke="#00aa00" stroke-width="1.50"');
    expect(svg).toContain('stroke="#ff00ff" stroke-width="0.25"');
    expect(svg).toContain('stroke="#00ffff"');
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain('opacity="0.500"');
  });

  it("escapes the title and notes", () => {
    const svg = renderSvg(vectorScene());
    expect(svg).toContain("<title>Front (A&amp;B) (M)</title>");
    expect(svg).toContain("Café &lt;test&gt; &amp; more");
  });

  it("closes a closed stroke and leaves an open one open", () => {
    const base = vectorScene();
    const closed = { ...base, items: [{ kind: "stroke" as const, layerId: "s", points: [[0, 0], [5, 0], [5, 5]] as const, closed: true, widthMm: 1, colour: "#000000", opacity: 1, blend: "normal" as const }] };
    expect(renderSvg(closed)).toMatch(/d="M[^"]*Z" fill="none"/);
    expect(renderSvg(base)).toMatch(/d="M[^"Z]*" fill="none" stroke="#00aa00"/);
  });

  it("writes a shared picture once and uses it twice with a clip", async () => {
    const svg = renderSvg(await imageScene());
    expect(wellFormed(svg)).toBe(true);
    expect(svg.match(/<image /g)).toHaveLength(1);
    expect(svg.match(/<use /g)).toHaveLength(2);
    expect(svg).toContain("data:image/png;base64,");
    expect(svg).toContain('clip-path="url(#clip0)"');
    expect(svg).toContain("clip-rule");
  });

  it("writes blend modes for multiply, screen and overlay only", () => {
    const base = vectorScene();
    const items = (["multiply", "screen", "overlay", "knock-out"] as const).map((blend, index) => ({ ...(base.items[0] as typeof base.items[0] & { kind: "fill" }), layerId: `l${index}`, blend }));
    const svg = renderSvg({ ...base, items });
    expect(svg).toContain("mix-blend-mode:multiply");
    expect(svg).toContain("mix-blend-mode:screen");
    expect(svg).toContain("mix-blend-mode:overlay");
    expect(svg.match(/mix-blend-mode/g)).toHaveLength(3);
  });

  it("is byte-identical across runs", async () => {
    const scene = await imageScene();
    expect(renderSvg(scene)).toBe(renderSvg(scene));
  });

  it("rejects a colour that is not #rrggbb", () => {
    const base = vectorScene();
    const bad = { ...base, items: [{ ...(base.items[0] as typeof base.items[0] & { kind: "fill" }), colour: 'red" onload="x' }] };
    expect(() => renderSvg(bad)).toThrow(RangeError);
    expect(() => renderSvg({ ...base, margin: [{ ...(base.margin[0] as (typeof base.margin)[0]), colour: "#FFF" }] })).toThrow(RangeError);
  });

  it("rejects a number that is not finite", () => {
    const base = vectorScene();
    expect(() => renderSvg({ ...base, cut: [[Number.NaN, 0]] })).toThrow(RangeError);
  });

  it("needs the flattened art for a raster scene, and writes one picture from it", async () => {
    expect(() => renderSvg(rasterScene())).toThrow(RangeError);
    const svg = await renderSvgAsync(rasterScene());
    expect(svg.match(/<image /g)).toHaveLength(1);
    expect(svg).not.toContain("<path d=\"M40.00");
    expect(svg).toContain('id="guides"');
    expect(svg).toContain('id="margin"');
    expect(await renderSvgAsync(vectorScene())).toBe(renderSvg(vectorScene()));
  });
});
