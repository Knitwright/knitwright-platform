import { describe, expect, it } from "vitest";
import { reencodeEmbedded } from "./embed";
import { parseSvg } from "./parse";
import { readXml, decodeEntities } from "./xml";

const parse = (inner: string, attrs = 'viewBox="0 0 10 10"') =>
  parseSvg(new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${attrs}>${inner}</svg>`), reencodeEmbedded);

describe("gradients", () => {
  it("takes stops from the gradient it points to, and reads user-space units, spread and a transform", async () => {
    const { model } = await parse(
      `<defs><linearGradient id="base"><stop offset="20%" stop-color="#f00"/><stop offset="0.1" stop-color="#00f" stop-opacity=".5"/></linearGradient>
       <linearGradient id="a" xlink:href="#base" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="10" y2="0" spreadMethod="reflect" gradientTransform="rotate(10)"/>
       <radialGradient id="r" href="#base" cx="30%" cy="40%" r="50%" fx="10%"/></defs>
       <rect width="5" height="5" fill="url(#a)"/><rect width="5" height="5" fill="url(#r)" stroke="url(#a)" stroke-width="2"/>`,
    );
    const [linear, radial] = model.gradients;
    expect(linear).toMatchObject({ type: "linear", units: "userSpaceOnUse", spread: "reflect", x2: 10 });
    expect(linear.transform).toBeDefined();
    // A later stop never sits before an earlier one.
    expect(linear.stops.map((stop) => stop.offset)).toEqual([0.2, 0.2]);
    expect(radial).toMatchObject({ type: "radial", units: "objectBoundingBox", cx: 0.3, cy: 0.4, r: 0.5, fx: 0.1 });
  });

  it("draws nothing for a gradient with no stops, one that is missing, or one that is not a gradient", async () => {
    const { model } = await parse(
      '<defs><linearGradient id="empty"/><rect id="notgrad" width="1" height="1"/></defs><rect width="5" height="5" fill="url(#empty)"/><rect width="5" height="5" fill="url(#nope)" stroke="url(#notgrad)" stroke-width="1"/>',
    );
    expect(model.gradients).toEqual([]);
    const paints = JSON.stringify(model.nodes);
    expect(paints).not.toContain('"gradient"');
  });

  it("follows a chain of gradient references only so far", async () => {
    const { model } = await parse(
      '<defs><linearGradient id="a" href="#b"/><linearGradient id="b" href="#c"/><linearGradient id="c" href="#d"/><linearGradient id="d" href="#e"/><linearGradient id="e" href="#f"/><linearGradient id="f"><stop offset="0" stop-color="red"/></linearGradient></defs><rect width="5" height="5" fill="url(#a)"/>',
    );
    expect(model.gradients).toEqual([]);
  });
});

describe("paint and style details", () => {
  it("honours stroke width zero, fill and stroke opacity, currentColor on stroke, and inherit", async () => {
    const { model } = await parse(
      '<g stroke="blue" stroke-width="0" color="#101010"><rect width="1" height="1" fill-opacity=".5"/><rect width="1" height="1" stroke="currentColor" stroke-width="3" stroke-opacity=".25" fill="inherit"/><rect width="1" height="1" style="stroke-linecap:round;stroke-linejoin:bevel;stroke-miterlimit:2;fill-rule:evenodd;stroke-width:2"/></g>',
    );
    const rects = (model.nodes[0].kind === "group" ? model.nodes[0].children : model.nodes) as { kind: string; stroke: unknown; fill: unknown; fillRule?: string; lineCap?: string; lineJoin?: string; miterLimit?: number }[];
    expect(rects[0].stroke).toEqual({ type: "none" });
    expect(rects[0].fill).toMatchObject({ opacity: 0.5 });
    expect(rects[1].stroke).toEqual({ type: "colour", hex: "#101010", opacity: 0.25 });
    expect(rects[2]).toMatchObject({ fillRule: "evenodd", lineCap: "round", lineJoin: "bevel", miterLimit: 2 });
  });

  it("keeps an ampersand written as an entity in an attribute", async () => {
    const { model } = await parse('<rect id="a&amp;b" width="1" height="1" fill="#f00"/>');
    expect(model.nodes).toHaveLength(1);
  });

  it("applies visibility hidden and a bad transform is ignored with a note", async () => {
    const { model, warnings } = await parse('<rect width="1" height="1" visibility="hidden"/><rect width="2" height="2" transform="wobble(1)"/>');
    expect(model.nodes).toHaveLength(1);
    expect(warnings).toContain("A transform in the file could not be read and was ignored.");
  });

  it("keeps clip paths made of shapes, and drops a clip with nothing in it or a missing one", async () => {
    const { model } = await parse(
      '<clipPath id="k"><rect width="3" height="3" transform="translate(1 1)"/><text>x</text></clipPath><clipPath id="empty"><text>x</text></clipPath><rect width="9" height="9" clip-path="url(#k)"/><rect width="9" height="9" clip-path="url(#empty)"/><rect width="9" height="9" clip-path="url(#missing)"/><g id="notclip"/><rect width="4" height="4" clip-path="url(#notclip)"/>',
    );
    expect(model.clips).toHaveLength(1);
    expect(model.nodes.filter((node) => node.kind === "path" && node.clipId === "c1")).toHaveLength(1);
    expect(model.nodes).toHaveLength(4);
  });

  it("reads use with a shared clip, nested groups with opacity, and refuses symbols with a note", async () => {
    const { model, warnings } = await parse(
      '<defs><symbol id="s"><rect width="1" height="1"/></symbol><g id="g"><rect width="2" height="2"/></g></defs><use href="#s"/><g opacity=".5"><use href="#g" opacity=".5" x="1"/></g>',
    );
    expect(warnings).toContain("Effects in the file (filters, masks, patterns or markers) were left out.");
    expect(model.nodes).toHaveLength(1);
  });

  it("handles an svg inside an svg, an a element with a local link, and a switch", async () => {
    const { model } = await parse('<svg x="1" y="1"><rect width="2" height="2"/></svg><a href="#x"><rect width="2" height="2"/></a><switch><rect width="1" height="1"/></switch>');
    expect(model.nodes.length).toBeGreaterThanOrEqual(2);
  });
});

describe("the XML reader's edges", () => {
  it("decodes the five entities and number references, and refuses others", () => {
    expect(decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos; &#65;&#x42;")).toBe("a & b <c> \"d\" 'e' AB");
    expect(() => decodeEntities("&nbsp;")).toThrow();
    expect(() => decodeEntities("&#1;")).toThrow();
    expect(() => decodeEntities("a & b")).toThrow();
    expect(decodeEntities("plain")).toBe("plain");
  });

  it("reads text, cdata and comments, and refuses what is not well formed", () => {
    const root = readXml('﻿<?xml version="1.0"?><a><!-- c --><b x="1">t<![CDATA[<raw>]]></b><c/></a>');
    expect(root.children.map((child) => child.name)).toEqual(["b", "c"]);
    expect(root.children[0].text).toBe("t<raw>");
    for (const bad of ["<a></b>", "<a><![CDATA[x</a>", "<![CDATA[x]]><a/>", "<a x='1' x='2'/>", "<a", "<a>text", "<1a/>", "<a x=\"<\"/>", "<a/ >"]) {
      expect(() => readXml(bad), bad).toThrow();
    }
  });
});
