import { describe, expect, it } from "vitest";
import { watermarkSvg } from "@/lib/media/watermark";
import type { SlotFill } from "../assets";
import { place } from "../layout";
import { buildLayouts } from "../templates/plans";
import { layoutSvg, type DrawInput } from "./svg";

const SIZE = { width: 400, height: 500 };
const layout = () => buildLayouts().find((one) => one.key === "new-kit-reveal")!;

const PICTURE = "data:image/png;base64,iVBORw0KGgo=";

const drawn = (over: Partial<DrawInput> = {}): DrawInput => ({
  size: SIZE,
  slots: place(layout().slots, SIZE),
  fills: new Map<string, SlotFill>([["headline", { kind: "words", text: "New kit" }]]),
  pictures: new Map([["mockup", PICTURE]]),
  colours: { background: "#ffffff", primary: "#1b2a49" },
  withBackground: true,
  watermark: null,
  ...over,
});

describe("the layout as one drawing", () => {
  it("is an SVG of the artboard's own size", () => {
    const svg = layoutSvg(drawn());
    expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg"`)).toBe(true);
    expect(svg).toContain(`width="400" height="500" viewBox="0 0 400 500"`);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("places a picture in the slot's own rectangle, cropped to fill it", () => {
    const svg = layoutSvg(drawn());
    expect(svg).toContain(`preserveAspectRatio="xMidYMid slice"`);
    expect(svg).toContain(`href="${PICTURE}"`);
  });

  it("draws a labelled empty frame where there is no picture, and invents nothing", () => {
    const svg = layoutSvg(drawn({ pictures: new Map() }));
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("<title>Mockup</title>");
    expect(svg).not.toContain("<image");
  });

  it("sets the words in the brand style's family and the slot's colour role", () => {
    const svg = layoutSvg(drawn());
    expect(svg).toContain(`font-weight="700"`);
    expect(svg).toContain(`fill="#1b2a49"`);
    expect(svg).toContain(">New kit<");
  });

  it("leaves the background out when it was asked to, so the file stays transparent", () => {
    const withIt = layoutSvg(drawn());
    const without = layoutSvg(drawn({ withBackground: false }));

    expect(withIt).toContain(`fill="#ffffff"`);
    expect(without).not.toContain(`width="400" height="500" fill="#ffffff"`);
  });

  it("escapes what a person typed, so no text can change the drawing", () => {
    const svg = layoutSvg(drawn({ fills: new Map<string, SlotFill>([["headline", { kind: "words", text: '</text><script>x</script>&"' }]]) }));
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;/text&gt;");
  });

  it("carries the platform's own watermark when one was given, and no second mark of its own", () => {
    const mark = watermarkSvg(SIZE.width, SIZE.height);
    const svg = layoutSvg(drawn({ watermark: mark }));

    expect(svg).toContain(mark);
    expect(svg.split("Knitwright preview").length - 1).toBe(mark.split("Knitwright preview").length - 1);
  });

  it("embeds no font file and names a generic family instead", () => {
    const svg = layoutSvg(drawn());
    expect(svg).not.toContain("@font-face");
    expect(svg).toContain("Helvetica, Arial, sans-serif");
  });

  it("gives the same bytes for the same layout, every time", () => {
    expect(layoutSvg(drawn())).toBe(layoutSvg(drawn()));
  });

  it("draws every layout of 07 without a slot of a kind it does not know", () => {
    for (const one of buildLayouts()) {
      const svg = layoutSvg(drawn({ slots: place(one.slots, SIZE), pictures: new Map(), fills: new Map() }));
      expect(svg.length, one.key).toBeGreaterThan(100);
      expect(svg).not.toContain("undefined");
    }
  });
});
