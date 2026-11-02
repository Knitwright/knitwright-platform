import { describe, expect, it } from "vitest";
import { exportFileName, exportVerdict, quickVerdict, type ExportBoard, type ExportRequest } from "./panel";
import { MAX_EXPORT_PIXELS, type ExportTarget, type WatermarkRule } from "./targets";

const target = (over: Partial<ExportTarget> = {}): ExportTarget => ({
  key: "png-1x",
  label: "PNG 1x",
  lead: "The artboard at its own size, for a screen.",
  format: "png",
  colourSpace: "rgb",
  dpi: 72,
  scale: 1,
  quick: true,
  sort: 10,
  ruleId: "R-GAP-000",
  note: "not reviewed by anyone",
  ...over,
});

const FREE: WatermarkRule = { plan: "free", label: "Free plan", watermarked: true, maxDpi: 72, ruleId: "R-GAP-000", note: "the spec's sentence" };
const PAID: WatermarkRule = { plan: "paid", label: "Paid plan", watermarked: false, maxDpi: 300, ruleId: "R-GAP-000", note: "the spec's sentence" };

const board = (name = "New kit 4:5", size = { width: 1080, height: 1350 }): ExportBoard => ({ id: "b1", name, size });

const request = (over: Partial<ExportRequest> = {}): ExportRequest => ({
  boards: [board()],
  width: 1080,
  height: 1350,
  unit: "px",
  dpi: 72,
  format: "png",
  colourSpace: "rgb",
  removeBackground: false,
  rule: PAID,
  cmykProfile: false,
  ...over,
});

const reasonOf = (verdict: ReturnType<typeof exportVerdict>): string => (verdict.ok ? "" : verdict.reason);

describe("what the export panel would produce", () => {
  it("gives the pixels, the live print size and one file name", () => {
    const verdict = exportVerdict(request());
    expect(verdict.ok).toBe(true);
    expect(verdict.ok && verdict.plan).toMatchObject({
      size: { width: 1080, height: 1350 },
      printSize: "1080 px × 1350 px",
      fileNames: ["new-kit-4-5.png"],
      zip: false,
      rasterised: true,
      watermark: false,
    });
  });

  it("reads the size in the unit asked for and shows the print size live", () => {
    const mm = exportVerdict(request({ width: 210, height: 297, unit: "mm", dpi: 300 }));
    expect(mm.ok && mm.plan.size).toEqual({ width: 2480, height: 3508 });
    expect(mm.ok && mm.plan.printSize).toBe("210.0 mm × 297.0 mm");

    // A file is a whole number of pixels, so the print size shown is the size of the file that will
    // really be made, not the number typed in: 8.27 in at 72 dpi is 595.44 px, which is 595 px.
    const inches = exportVerdict(request({ width: 8.27, height: 11.69, unit: "in", dpi: 72 }));
    expect(inches.ok && inches.plan.size).toEqual({ width: 595, height: 842 });
    expect(inches.ok && inches.plan.printSize).toBe("8.26 in × 11.69 in");
  });

  it("changes the pixels when the resolution changes, and keeps the print size the same", () => {
    const screen = exportVerdict(request({ width: 210, height: 297, unit: "mm", dpi: 72 }));
    const print = exportVerdict(request({ width: 210, height: 297, unit: "mm", dpi: 300 }));

    expect(screen.ok && screen.plan.size.width).toBe(595);
    expect(print.ok && print.plan.size.width).toBe(2480);
    // The same page, to a tenth of a millimetre either way: more dots, not a bigger print.
    expect(screen.ok && screen.plan.printSize).toBe("209.9 mm × 297.0 mm");
    expect(print.ok && print.plan.printSize).toBe("210.0 mm × 297.0 mm");
  });

  it("sends several artboards as a zip, with a name of its own for each", () => {
    const verdict = exportVerdict(request({ boards: [board("Story"), board("Story"), { id: "b3", name: "", size: { width: 1080, height: 1080 } }] }));
    expect(verdict.ok && verdict.plan.zip).toBe(true);
    expect(verdict.ok && verdict.plan.fileNames).toEqual(["story.png", "story-2.png", "artboard-3.png"]);
  });

  it("marks a file made of shapes as not rasterised, so a resolution is not promised", () => {
    const svg = exportVerdict(request({ format: "svg" }));
    expect(svg.ok && svg.plan.rasterised).toBe(false);
  });
});

describe("what the export panel refuses, and what it says instead", () => {
  it("refuses CMYK while no colour profile is on file, and says what to do", () => {
    const verdict = exportVerdict(request({ colourSpace: "cmyk", format: "pdf", dpi: 300 }));
    expect(verdict.ok).toBe(false);
    expect(reasonOf(verdict)).toBe("No colour profile is on file, so this file cannot be separated for a press. Export it as RGB, or ask us to put a profile on file.");
    expect(verdict.ok ? "" : verdict.ruleId).toBe("R-GAP-000");
  });

  it("refuses CMYK in a format that cannot carry it, even with a profile on file", () => {
    const verdict = exportVerdict(request({ colourSpace: "cmyk", format: "png", cmykProfile: true }));
    expect(reasonOf(verdict)).toContain("A CMYK file is a JPEG or a PDF");
  });

  it("allows CMYK once a profile is on file, for a JPEG and for a PDF", () => {
    expect(exportVerdict(request({ colourSpace: "cmyk", format: "jpeg", cmykProfile: true })).ok).toBe(true);
    expect(exportVerdict(request({ colourSpace: "cmyk", format: "pdf", cmykProfile: true, dpi: 300 })).ok).toBe(true);
  });

  it("refuses a transparent JPEG rather than filling the background in quietly", () => {
    expect(reasonOf(exportVerdict(request({ format: "jpeg", removeBackground: true })))).toContain("A JPEG has no transparency");
    expect(exportVerdict(request({ format: "png", removeBackground: true })).ok).toBe(true);
  });

  it("refuses more dots per inch than the plan allows, and names the figure", () => {
    const verdict = exportVerdict(request({ rule: FREE, dpi: 300, width: 210, height: 297, unit: "mm" }));
    expect(reasonOf(verdict)).toBe("Free plan exports go up to 72 dots per inch. Choose 72, or unlock this export.");
  });

  it("puts the mark on an export the plan watermarks, using the platform's existing one", () => {
    const verdict = exportVerdict(request({ rule: FREE }));
    expect(verdict.ok && verdict.plan.watermark).toBe(true);
  });

  it("refuses a size the canvas cannot draw, with the bound in the message", () => {
    expect(reasonOf(exportVerdict(request({ width: 4, height: 4 })))).toBe("The smallest artboard is 16 px.");
    expect(reasonOf(exportVerdict(request({ width: 30_000, height: 100 })))).toContain("The largest artboard is 20000 px.");
    expect(reasonOf(exportVerdict(request({ width: Number.NaN, height: 100 })))).toBe("Give a width and a height.");
  });

  it("refuses a file with more pixels than one file may hold, and says how many", () => {
    const side = Math.ceil(Math.sqrt(MAX_EXPORT_PIXELS)) + 1000;
    const verdict = exportVerdict(request({ width: side, height: side }));
    expect(reasonOf(verdict)).toContain("and one file goes up to 120");
  });

  it("refuses an export with no artboard chosen", () => {
    expect(reasonOf(exportVerdict(request({ boards: [] })))).toBe("Pick at least one artboard to export.");
  });
});

describe("the quick export", () => {
  it("multiplies the artboard's own pixels by the target's scale", () => {
    const twice = quickVerdict(target({ key: "png-2x", label: "PNG 2x", scale: 2 }), board(), PAID);
    expect(twice.ok && twice.plan.size).toEqual({ width: 2160, height: 2700 });
    expect(twice.ok && twice.plan.fileNames).toEqual(["new-kit-4-5.png"]);
  });

  it("refuses a scale that would pass the largest size the canvas draws", () => {
    const huge = quickVerdict(target({ scale: 3 }), board("Big", { width: 9000, height: 9000 }), PAID);
    expect(reasonOf(huge)).toContain("wider than 20000 px");
  });

  it("refuses an artboard too small to make a file of", () => {
    const tiny = quickVerdict(target({ scale: 1 }), board("Tiny", { width: 8, height: 8 }), PAID);
    expect(reasonOf(tiny)).toBe("The smallest file is 16 px.");
  });

  it("carries the watermark of the plan, as the full export does", () => {
    const free = quickVerdict(target(), board(), FREE);
    expect(free.ok && free.plan.watermark).toBe(true);
    expect(free.ok && free.plan.dpi).toBe(72);
  });
});

describe("the name a file is saved under", () => {
  it("keeps letters and digits, and nothing else", () => {
    expect(exportFileName("Órder your kit! (1:1)", "png", 0)).toBe("rder-your-kit-1-1.png");
    expect(exportFileName("", "pdf", 2)).toBe("artboard-3.pdf");
    expect(exportFileName("   ", "jpeg", 0)).toBe("artboard-1.jpg");
    expect(exportFileName("a".repeat(80), "svg", 0)).toBe(`${"a".repeat(48)}.svg`);
  });
});
