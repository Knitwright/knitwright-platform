import { describe, expect, it } from "vitest";
import { jersey } from "@/lib/editor/fixtures/article";
import type { EditorDesign } from "@/lib/editor/slots";
import { validateChip } from "@/lib/editor";
import { start } from "@/lib/garment/fixtures/specs";
import { PLAN_SETTINGS } from "@/lib/plans/catalogue";
import { exportAccess, NOTES_COMING, ORDER_NOTE, patternNote, STUDIO_EXPORT_TABS, STUDIO_TABS, studioTab, techPackChecklist } from "./export";
import { fitChip } from "./fit";
import { devStudio, DEV_CLUB } from "./fixtures/dev";
import { clubLibrary, FABRIC_CHIPS, filterFabrics, initialsOf, isApprovedRepeat, librarySection } from "./library";
import { isShelf, parseShelf, SHELF_GROUPS, SHELVES, shelfEntry, withShelf } from "./shelves";
import { COMING_SOON, rememberWelcome, shouldWelcome, WELCOME_KEY, WORKS_WELL } from "./welcome";

/** Plan v6 G1, decision 0150: Garment Studio's library column, Fit checked, Export and welcome, as data. */

const design = (patch: Partial<EditorDesign> = {}): EditorDesign => ({
  projectId: "p1",
  version: 3,
  spec: start("team-jersey", "men"),
  article: jersey(),
  form: { options: {}, parameters: {} },
  size: "M",
  sizes: ["XS", "S", "M", "L", "XL", "3XL"],
  colourwayId: "main",
  draft: null,
  busy: false,
  ...patch,
});

describe("the library column", () => {
  it("draws Fabra's three groups, in order, with every shelf in exactly one of them", () => {
    expect(SHELF_GROUPS.map((group) => group.label)).toEqual(["Knitwright library", "Your library", "Tools"]);
    expect(SHELF_GROUPS[0].entries.map((one) => one.label)).toEqual(["Fabrics", "Colours", "Repeats", "Graphics", "Trims"]);
    expect(SHELF_GROUPS[1].entries.map((one) => one.label)).toEqual(["Fabrics", "Palettes", "Repeats", "Brand kit", "Uploads"]);
    expect(SHELF_GROUPS[2].entries.map((one) => one.label)).toEqual(["Repeat prints", "Trim generator"]);
    expect(SHELF_GROUPS.flatMap((group) => group.entries.map((one) => one.id))).toEqual([...SHELVES]);
  });

  it("marks Repeat prints, and only it, as a paid tool", () => {
    expect(SHELVES.filter((id) => shelfEntry(id).premium)).toEqual(["repeat-prints"]);
    expect(shelfEntry("own-fabrics").title).toBe("Your fabrics");
  });

  it("reads the shelf from the address, and ignores anything that is not one", () => {
    expect(parseShelf("colours")).toBe("colours");
    expect(parseShelf(["trims", "colours"])).toBe("trims");
    expect(parseShelf("nope")).toBeNull();
    expect(parseShelf(undefined)).toBeNull();
    expect(isShelf("brand-kit")).toBe(true);
  });

  it("writes the shelf into the address and takes it off again, keeping the rest", () => {
    expect(withShelf("?focus=garment&tool=sizes", "fabrics")).toBe("?focus=garment&tool=sizes&shelf=fabrics");
    expect(withShelf("?focus=garment&shelf=fabrics", null)).toBe("?focus=garment");
    expect(withShelf("?shelf=fabrics", null)).toBe("");
  });
});

describe("Fit checked", () => {
  const clear = validateChip({ checks: [{ code: "x", severity: null, message: "ok", target: { article: null, panel: null }, ruleId: "R-GAP-000", passed: true }], draft: null, article: null, form: { options: {}, parameters: {} } });

  it("says Fit checked only when the checks block nothing and the model matches the form", () => {
    expect(fitChip(clear, "ready")).toMatchObject({ label: "Fit checked", tone: "ok" });
    expect(fitChip(clear, "ready").chip.label).toBe("Fit checked");
  });

  it("says Not sim ready when the model is missing or behind the form", () => {
    expect(fitChip(clear, "stale")).toMatchObject({ label: "Not sim ready", tone: "warn" });
    expect(fitChip(clear, "none").description).toContain("no 3D model");
  });

  it("puts what blocks first, and says when nothing has been checked", () => {
    expect(fitChip({ ...clear, tone: "blocked", label: "2 to fix" }, "ready")).toMatchObject({ label: "2 to fix", tone: "bad" });
    expect(fitChip({ ...clear, tone: "unchecked", label: "Not checked yet" }, "ready")).toMatchObject({ label: "Not checked yet", tone: "neutral" });
  });
});

describe("the Export panel", () => {
  it("has Fabra's six tabs, each backed by one of the Export panel's own", () => {
    expect(STUDIO_TABS.map((tab) => tab.label)).toEqual(["Tech pack", "Images", "Pattern", "Artwork", "On model", "Flat lay"]);
    expect(STUDIO_TABS.map((tab) => tab.id)).toEqual([...STUDIO_EXPORT_TABS]);
    expect(studioTab("artwork").from).toBe("print-files");
    expect(studioTab("flat-lay").from).toBe("mockups");
  });

  it("lists the eight tech pack sections, Compliance labels last, with the base's sample size and the run", () => {
    const items = techPackChecklist(jersey(), ["XS", "S", "M", "L", "XL", "3XL"]);
    expect(items.map((item) => item.label)).toEqual([
      "Overview",
      "Colourways",
      "Sample measurements",
      "Size chart",
      "Bill of materials",
      "Construction callouts",
      "Artworks",
      "Compliance labels",
    ]);
    expect(items[3].detail).toBe("Graded XS–3XL");
    expect(items[2].detail).toMatch(/^Sample size /);
  });

  it("says so where there is no sample size or size run, and lists notes as coming", () => {
    const items = techPackChecklist(null, []);
    expect(items[2].detail).toBe("No sample size on file yet");
    expect(items[3].detail).toBe("No size run yet");
    expect(techPackChecklist(null, ["M"])[3].detail).toBe("Graded M");
    expect(NOTES_COMING).toContain("coming");
    expect(ORDER_NOTE).toContain("free");
  });

  it("says who gets the pattern, by production class", () => {
    expect(patternNote({ ...jersey(), productionClass: "A" })).toContain("stay with the factory");
    expect(patternNote({ ...jersey(), productionClass: "B" })).toContain("DXF on request");
    expect(patternNote(null)).toContain("not on a base article");
  });

  it("lets Export make files only on a plan with tech pack exports", () => {
    expect(exportAccess()).toEqual({ allowed: false, planName: "Free", perMonth: 0 });
    expect(exportAccess(PLAN_SETTINGS, "starter")).toMatchObject({ allowed: true, perMonth: 5 });
    expect(exportAccess(PLAN_SETTINGS, "club_scale")).toMatchObject({ allowed: true, perMonth: null });
    expect(exportAccess({ ...PLAN_SETTINGS, plans: [] }, "starter")).toEqual({ allowed: false, planName: "starter", perMonth: 0 });
  });
});

describe("the library panels' lists", () => {
  it("are the Library toolbar's own sections", () => {
    expect(librarySection(design(), "kw-fabrics").title).toBe("Fabrics");
    expect(librarySection(design(), "kw-colours").items.length).toBeGreaterThan(0);
  });

  it("filter the fabrics by the search box and the chip together, case-blind", () => {
    const items = librarySection(design(), "kw-fabrics").items;
    expect(filterFabrics(items, "", null)).toEqual(items);
    expect(filterFabrics(items, "zzz-nothing", null)).toEqual([]);
    const first = items[0];
    expect(filterFabrics(items, (first.code ?? first.label).toUpperCase(), null)).toContain(first);
    expect(FABRIC_CHIPS).toEqual(["Polyester", "Mesh", "Interlock", "Recycled"]);
    expect(filterFabrics(items, "", "Nothing-matches")).toEqual([]);
  });

  it("put the base's approved repeats apart from the styles the platform draws", () => {
    const items = librarySection(design(), "kw-pattern-fills").items;
    expect(items.some(isApprovedRepeat)).toBe(true);
    expect(items.some((item) => !isApprovedRepeat(item))).toBe(true);
  });

  it("read the club's palettes and uploads from Brand Studio's record", () => {
    const club = clubLibrary(
      {
        brandId: "b",
        brandName: "Lahore Lions",
        profile: {} as never,
        fonts: [],
        palettes: [{ id: "p", name: "Club", source: "brand-studio", colours: [{ id: "c", name: "Navy", hex: "#0b1f4b", pantoneTcx: "19-3933 TCX" }, { id: "d", name: "Gold", hex: "#f2b705", pantoneTcx: null }] }],
        assets: [{ id: "a", kind: "crest", artworkId: "x", label: "Crest", sponsorName: null, printWidthMm: null, source: "brand-studio" }],
      },
      "fallback",
    );
    expect(club.name).toBe("Lahore Lions");
    expect(club.palettes[0].colours[0]).toMatchObject({ kind: "colour", swatch: "#0b1f4b", code: "19-3933 TCX", apply: { kind: "colour", colour: "19-3933 TCX" } });
    expect(club.palettes[0].colours[1].card).toHaveLength(1);
    expect(club.uploads).toEqual([{ id: "a", label: "Crest", kind: "crest" }]);
  });

  it("fall back to an empty library under the brand's name when the record could not be read", () => {
    expect(clubLibrary(null, "Lions")).toEqual({ name: "Lions", palettes: [], uploads: [] });
    expect(clubLibrary({ brandId: "b", brandName: "", profile: {} as never, fonts: [], palettes: [], assets: [] }, "Lions").name).toBe("Lions");
  });

  it("give the club's avatar its initials", () => {
    expect(initialsOf("Lahore Lions FC")).toBe("LL");
    expect(initialsOf("  ")).toBe("?");
    expect(initialsOf("· Rovers")).toBe("R");
  });
});

/** An in-memory Storage, or one that throws, for the welcome's two stores. */
const store = (throws = false) => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => {
      if (throws) throw new Error("blocked");
      return values.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (throws) throw new Error("blocked");
      values.set(key, value);
    },
  };
};

describe("the beta welcome", () => {
  it("shows until it is closed, then for good when the box was ticked", () => {
    const local = store();
    const session = store();
    expect(shouldWelcome(local, session)).toBe(true);
    rememberWelcome(local, session, true);
    expect(local.values.get(WELCOME_KEY)).toBe("hidden");
    expect(shouldWelcome(local, store())).toBe(false);
  });

  it("only for the rest of the visit when the box was not ticked", () => {
    const local = store();
    const session = store();
    rememberWelcome(local, session, false);
    expect(session.values.get(WELCOME_KEY)).toBe("shown");
    expect(shouldWelcome(local, session)).toBe(false);
    expect(shouldWelcome(local, store())).toBe(true);
  });

  it("never shows where the browser cannot remember, and never throws", () => {
    expect(shouldWelcome(null, null)).toBe(false);
    expect(shouldWelcome(store(true), store())).toBe(false);
    expect(() => rememberWelcome(store(true), store(true), true)).not.toThrow();
    expect(() => rememberWelcome(null, null, false)).not.toThrow();
  });

  it("lists what works and what is coming", () => {
    expect(WORKS_WELL).toHaveLength(4);
    expect(COMING_SOON).toHaveLength(3);
  });
});

describe("the /dev fixture", () => {
  it("builds a studio on JSY-SS-01 with a made-up club and three colourways", () => {
    const studio = devStudio({ shelf: "fabrics" });
    expect(studio.article.code).toBe("JSY-SS-01");
    expect(studio.data.colourways.map((way) => way.name)).toEqual(["Home", "Away", "Goalkeeper"]);
    expect(studio.state.sizes.length).toBeGreaterThan(0);
    expect(DEV_CLUB.name).toContain("made up");
  });
});
