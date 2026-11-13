import { describe, expect, it } from "vitest";
import { GARMENT_BOX } from "@/lib/canvas";
import type { ArtboardPreset } from "@/lib/launch";
import {
  ARTBOARD_TABS,
  artboardBody,
  checkSize,
  customOf,
  DEFAULT_CUSTOM,
  garmentBody,
  orientationOf,
  placeForNew,
  presetsIn,
  sizeLine,
  withOrientation,
} from "./artboard";
import { clampOpacity, cssColour, fromSquare, hexLabel, hexToHsv, hexToRgb, hsvToHex, hueHex, nudge, parseHex, parseRgb, printWarning, rgbText } from "./colour";
import { ALL_FONTS, chipsFor, filterFonts, KIT_SAFE, unpickableReason, type FontRow } from "./fonts";
import { historyDesign, LOCK_NOTE, shownRows, versionRows, whenLine } from "./versions";

describe("whose history the panel shows", () => {
  const boards = [
    { id: "a", kind: "artboard", settings: {} },
    { id: "g1", kind: "garment", settings: { designProjectId: "d1" } },
    { id: "g2", kind: "design", settings: { designProjectId: "d2" } },
  ];
  it("prefers the selected garment, then the canvas's design, then the first garment", () => {
    expect(historyDesign(boards, ["g2"], "home")).toBe("d2");
    expect(historyDesign(boards, ["a"], "home")).toBe("home");
    expect(historyDesign(boards, [], null)).toBe("d1");
    expect(historyDesign([{ id: "x", kind: "garment", settings: { designProjectId: "" } }], [], null)).toBeNull();
  });
});

describe("the colour picker's maths", () => {
  it("reads what a person types as #rrggbb", () => {
    expect(parseHex("0B1F4B")).toBe("#0b1f4b");
    expect(parseHex("#F2B705")).toBe("#f2b705");
    expect(parseHex("#abc")).toBe("#aabbcc");
    expect(parseHex("navy")).toBeNull();
    expect(parseRgb("11, 31, 75")).toBe("#0b1f4b");
    expect(parseRgb("11 31")).toBeNull();
    expect(parseRgb("300, 0, 0")).toBeNull();
    expect(rgbText("#0b1f4b")).toBe("11, 31, 75");
    expect(hexToRgb("bad")).toEqual([187, 170, 221]);
    expect(hexToRgb("nope")).toEqual([0, 0, 0]);
  });

  it("goes to HSV and back without losing the colour", () => {
    for (const hex of ["#0b1f4b", "#f2b705", "#2f6bff", "#d92d20", "#067647", "#ffffff", "#000000", "#808080", "#ff00ff", "#00ffff"]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
    expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv("#000000")).toEqual({ h: 0, s: 0, v: 0 });
    expect(hueHex(120)).toBe("#00ff00");
    expect(hsvToHex({ h: 300, s: 1, v: 1 })).toBe("#ff00ff");
  });

  it("maps a point in the square and clamps steps", () => {
    expect(fromSquare(200, 1.2, -0.1)).toEqual({ h: 200, s: 1, v: 1 });
    expect(nudge(0.95, 0.1, 0, 1)).toBe(1);
    expect(nudge(5, -10, 0, 360)).toBe(0);
    expect(clampOpacity(140)).toBe(100);
    expect(clampOpacity(Number.NaN)).toBe(100);
    expect(clampOpacity(42.4)).toBe(42);
  });

  it("draws a swatch with its opacity, and labels it as the rows do", () => {
    expect(cssColour({ hex: "#0b1f4b", opacity: 50 })).toBe("rgba(11, 31, 75, 0.5)");
    expect(hexLabel("#0b1f4b")).toBe("0B1F4B");
    expect(hexLabel("x")).toBe("000000");
  });

  it("warns on a colour the sublimation estimate cannot reach, and only then", () => {
    expect(printWarning("#ff00ff")).toMatch(/more saturated than a sublimation print/);
    expect(printWarning("#808080")).toBeNull();
    expect(printWarning("nope")).toBeNull();
  });
});

const font = (key: string, extra: Partial<FontRow> = {}): FontRow => ({ key, label: key, roleLabel: null, family: null, licenceNote: "On file.", selectable: true, ...extra });

describe("the font list", () => {
  it("shows only All until the list carries tags", () => {
    expect(chipsFor([font("geist")])).toEqual([{ id: ALL_FONTS, label: "All" }]);
  });

  it("adds Kit-safe and each tag a font carries", () => {
    const rows = [font("a", { kitSafe: true, tags: ["sans-serif"] }), font("b", { tags: ["varsity", "sans-serif"] })];
    expect(chipsFor(rows).map((chip) => chip.label)).toEqual(["All", "Kit-safe", "Sans Serif", "Varsity"]);
    expect(filterFonts(rows, KIT_SAFE, "").map((row) => row.key)).toEqual(["a"]);
    expect(filterFonts(rows, "varsity", "").map((row) => row.key)).toEqual(["b"]);
    expect(filterFonts(rows, ALL_FONTS, "B").map((row) => row.key)).toEqual(["b"]);
  });

  it("searches the role on the Brand tab, and explains a font that cannot be picked", () => {
    expect(filterFonts([font("x", { roleLabel: "Headline" })], ALL_FONTS, "head")).toHaveLength(1);
    expect(unpickableReason(font("p", { selectable: false, licenceNote: "No licence on file." }))).toBe("No licence on file.");
    expect(unpickableReason(font("g"))).toBeNull();
  });
});

const preset = (key: string, width: number, height: number, unit: ArtboardPreset["unit"] = "px"): ArtboardPreset => ({ key, label: key, width, height, unit, dpi: unit === "px" ? 72 : 300, ruleId: "R-GAP-000", note: "Placeholder" });
const PRESETS = [preset("social-post-4-5", 1080, 1350), preset("hero-banner-16-9", 1920, 1080), preset("a4-print", 210, 297, "mm"), preset("admin-new", 500, 500)];

describe("Choose Artboard Size", () => {
  it("has the six tabs, Products second and the paid one last", () => {
    expect(ARTBOARD_TABS).toEqual(["popular", "products", "social", "marketing", "store", "pod"]);
  });

  it("groups the seeded presets and keeps a new one in Popular", () => {
    expect(presetsIn("popular", PRESETS)).toHaveLength(4);
    expect(presetsIn("social", PRESETS).map((one) => one.key)).toEqual(["social-post-4-5"]);
    expect(presetsIn("store", PRESETS).map((one) => one.key)).toEqual(["hero-banner-16-9"]);
    expect(presetsIn("marketing", PRESETS).map((one) => one.key)).toEqual(["a4-print"]);
    expect(presetsIn("products", PRESETS)).toEqual([]);
    expect(presetsIn("pod", PRESETS)).toEqual([]);
  });

  it("writes a size line and turns a size round", () => {
    expect(sizeLine(210, 297, "mm")).toBe("210 × 297 mm");
    expect(sizeLine(8.27, 11.5, "in")).toBe("8.3 × 11.5 in");
    const a4 = customOf(PRESETS[2]!);
    expect(orientationOf(a4)).toBe("portrait");
    expect(withOrientation(a4, "landscape")).toMatchObject({ width: 297, height: 210 });
    expect(withOrientation(a4, "portrait")).toBe(a4);
    expect(withOrientation(DEFAULT_CUSTOM, "landscape")).toBe(DEFAULT_CUSTOM);
  });

  it("checks a size against the canvas's bounds, in pixels", () => {
    expect(checkSize({ ...DEFAULT_CUSTOM, width: 0 })).toMatchObject({ ok: false });
    expect(checkSize({ ...DEFAULT_CUSTOM, dpi: 0 })).toMatchObject({ ok: false });
    expect(checkSize({ ...DEFAULT_CUSTOM, width: 8 })).toEqual({ ok: false, reason: "An artboard is at least 16 px on each side." });
    expect(checkSize({ ...DEFAULT_CUSTOM, width: 30_000 })).toEqual({ ok: false, reason: "An artboard is at most 20,000 px on each side." });
    expect(checkSize(customOf(PRESETS[2]!))).toEqual({ ok: true, pixels: { width: 2480, height: 3508 } });
  });

  it("builds the bodies the launch shell's save takes", () => {
    expect(artboardBody("p1", DEFAULT_CUSTOM, { width: 1080, height: 1080 }, { x: 10, y: 20 })).toMatchObject({ kind: "artboard", width: 1080, x: 10, settings: { unit: "px", dpi: 72, margin: false } });
    const garment = garmentBody("p1", { id: "d1", name: "Home kit", version: 4 }, { x: 0, y: 0 });
    expect(garment).toMatchObject({ kind: "garment", width: GARMENT_BOX.width, height: GARMENT_BOX.height, settings: { designProjectId: "d1" }, inputVersion: 4, name: "Home kit" });
  });

  it("places a new board right of everything", () => {
    expect(placeForNew([])).toEqual({ x: 0, y: 0 });
    expect(placeForNew([{ x: 0, y: 40, width: 320, height: 380 }, { x: 500, y: 0, width: 200, height: 100 }])).toEqual({ x: 812, y: 0 });
  });
});

describe("the version history", () => {
  const inputs = [
    { version: 5, note: "Changed the collar", restoredFrom: null, createdAt: "2026-11-02T16:05:00Z" },
    { version: 7, note: "", restoredFrom: 4, createdAt: "2026-11-04T09:00:00Z" },
    { version: 6, note: "Away colourway added", restoredFrom: null, createdAt: "2026-11-03T11:02:00Z" },
    { version: 4, note: "", restoredFrom: null, createdAt: "2026-11-01T08:00:00Z" },
  ];
  const rows = versionRows(inputs, { 5: "ordered", 6: "approved" }, 7);

  it("lists newest first, with the current one first and the ordered one locked", () => {
    expect(rows.map((row) => row.version)).toEqual([7, 6, 5, 4]);
    expect(rows[0]).toMatchObject({ title: "Current version · v7", current: true, canRestore: false, line: "4 Nov 09:00 · restored from v4" });
    expect(rows[1]).toMatchObject({ title: "Approved for ordering · v6", locked: false, autosave: false });
    expect(rows[2]).toMatchObject({ title: "Ordered · v5", locked: true, line: "2 Nov 16:05 · locked to an order", canRestore: true });
    expect(rows[3]).toMatchObject({ title: "Saved · v4", autosave: true });
  });

  it("hides the plain saves when autosaves are off", () => {
    expect(shownRows(rows, true)).toHaveLength(4);
    expect(shownRows(rows, false).map((row) => row.version)).toEqual([7, 6, 5]);
  });

  it("says a current version's status, and copes with a bad date", () => {
    const one = versionRows([{ version: 2, note: "x", restoredFrom: null, createdAt: "nope" }], { 2: "validated" }, 2);
    expect(one[0]?.line).toBe("Checked");
    expect(whenLine("2026-01-09T03:04:00Z")).toBe("9 Jan 03:04");
    expect(LOCK_NOTE).toMatch(/never changes an order/);
  });
});
