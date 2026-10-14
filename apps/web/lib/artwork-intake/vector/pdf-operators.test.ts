import { describe, expect, it } from "vitest";
import { buildPdf } from "../fixtures/pdfs";
import { intakeVector } from "./index";
import { REFUSALS } from "./refuse";

const read = (content: string, options?: Parameters<typeof buildPdf>[1]) => intakeVector(buildPdf(content, options), "pdf");
const strokeOf = (node: unknown) => (node as { stroke: Record<string, unknown> | null }).stroke;

describe("pdf drawing operators", () => {
  it("reads line width, caps, joins, miter limit and dashes, and scales them by the page transform", async () => {
    const { doc } = await read("[3 2] 0 d 1 J 1 j 4 M 2 w 0 0 1 RG 10 10 m 50 10 l 50 40 l s");
    expect(strokeOf(doc.nodes[0])).toMatchObject({ width: 2, cap: "round", join: "round", miterLimit: 4, dash: [3, 2] });
    expect((doc.nodes[0] as unknown as { cmds: unknown[] }).cmds.at(-1)).toEqual(["Z"]);
  });

  it("reads every fill and stroke combination, and even-odd rules", async () => {
    const { doc } = await read("1 0 0 rg 0 0 1 RG 5 5 20 20 re B 30 5 20 20 re B* 55 5 20 20 re b 80 5 20 20 re b* 105 5 20 20 re f* 130 5 20 20 re S");
    const kinds = doc.nodes.map((n) => (n.t === "path" ? [n.fill !== null, n.stroke !== null, n.fillRule] : []));
    expect(kinds).toEqual([
      [true, true, "nonzero"],
      [true, true, "evenodd"],
      [true, true, "nonzero"],
      [true, true, "evenodd"],
      [true, false, "evenodd"],
      [false, true, "nonzero"],
    ]);
  });

  it("applies graphics state: widths, caps, joins, miter, dashes and opacity", async () => {
    const { doc } = await read("/G1 gs 0 0 1 RG 10 10 m 60 40 l S", {
      resources: "/ExtGState << /G1 << /LW 3 /LC 2 /LJ 2 /ML 5 /D [[2 1] 0] /CA 0.5 /ca 0.25 /SMask /None /BM /Normal >> >>",
    });
    expect(strokeOf(doc.nodes[0])).toMatchObject({ width: 3, cap: "square", join: "bevel", miterLimit: 5, opacity: 0.5 });
  });

  it("clips with the even-odd rule, and nests clips inside one another", async () => {
    const { doc } = await read("q 10 10 80 80 re W* n q 20 20 30 30 re W n 1 0 0 rg 0 0 100 100 re f Q 0 1 0 rg 0 0 100 100 re f Q");
    expect(doc.clips).toHaveLength(2);
    const outer = doc.nodes[0];
    expect(outer).toMatchObject({ t: "g", clip: "c1" });
    const children = (outer as unknown as { children: { t: string; clip?: string }[] }).children;
    expect(children.map((c) => c.t)).toEqual(["g", "path"]);
    expect(children[0].clip).toBe("c2");
  });

  it("applies the matrix of a form and puts its drawing in place", async () => {
    const { doc } = await read("/Fm0 Do", {
      resources: "/XObject << /Fm0 5 0 R >>",
      extraObjects: ["<< /Type /XObject /Subtype /Form /BBox [0 0 200 100] /Matrix [1 0 0 1 10 0] /Length 30 >>\nstream\n0 0 1 rg 0 0 20 20 re f\nendstream"],
    });
    const first = doc.nodes[0];
    expect(first.t === "path" && first.cmds[0]).toEqual(["M", 10, 100]);
  });

  it("ignores a restore with nothing saved, and an empty path", async () => {
    const { doc } = await read("Q 1 0 0 rg 10 10 m f 0 0 1 rg 0 0 5 5 re f");
    expect(doc.nodes).toHaveLength(1);
  });

  it("curves: quadratic-looking and full cubic curves keep their end points", async () => {
    const { doc } = await read("1 0 0 rg 10 10 m 20 50 60 50 70 10 c 90 5 100 5 v 110 40 120 40 y h f");
    const path = doc.nodes[0];
    expect(path.t === "path" && path.cmds.filter((c) => c[0] === "C")).toHaveLength(3);
  });

  it("refuses a pattern fill, saying to use a picture or SVG instead", async () => {
    await expect(
      read("/Pattern cs /P1 scn 0 0 100 50 re f", {
        resources:
          "/Pattern << /P1 << /PatternType 2 /Shading << /ShadingType 2 /ColorSpace /DeviceRGB /Coords [0 0 100 0] /Function << /FunctionType 2 /Domain [0 1] /C0 [1 0 0] /C1 [0 0 1] /N 1 >> >> >> >>",
      }),
    ).rejects.toThrow(REFUSALS.pdfNeedsPixels);
  });

  it("keeps a stroke of no width visible as a hairline", async () => {
    const { doc } = await read("0 w 0 0 1 RG 10 10 m 50 50 l S");
    expect((strokeOf(doc.nodes[0]) as { width: number }).width).toBeGreaterThan(0);
  });
});
