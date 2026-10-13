import { describe, expect, it } from "vitest";
import { designWith, madeUpForType } from "@/lib/flat/fixtures/designs";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { buildPackFor, buildTechPackPage, historyIsNewer, STALE_SENTENCE } from "./tech-pack-data";
import type { OpenProject, VersionsPage } from "./service";

const project = (spec: GarmentSpec, patch: Partial<OpenProject> = {}): OpenProject => ({
  id: "3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11",
  name: "Club shirt",
  styleNumber: "CP-7",
  season: "SS27",
  garmentType: spec.typeId,
  garmentLabel: "Crew neck tee",
  currentVersion: 3,
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-03T10:00:00Z",
  versionSavedAt: "2026-09-03T10:00:00Z",
  spec,
  dropped: [],
  ...patch,
});

const history = (count: number): VersionsPage => ({
  versions: Array.from({ length: count }, (_, index) => ({
    version: count - index,
    note: `Note ${count - index}.`,
    restoredFrom: null,
    createdAt: `2026-09-0${Math.min(9, count - index)}T10:00:00Z`,
  })),
  hasMore: false,
});

const page = (spec: GarmentSpec, more: Partial<Parameters<typeof buildTechPackPage>[0]> = {}) =>
  buildTechPackPage({ project: project(spec), history: history(3), brandName: "Test Brand", images: new Map(), now: new Date("2026-09-30T10:00:00Z"), ...more });


describe("buildTechPackPage", () => {
  it("builds the document from the project, the brand and the history", () => {
    const data = page(start("crew-tee"));
    expect(data.projectId).toBe("3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11");
    expect(data.name).toBe("Club shirt");
    expect(data.version).toBe(3);
    expect(data.pack.cover.brand).toEqual({ status: "set", value: "Test Brand", provenance: "brand-supplied" });
    expect(data.pack.cover.styleNumber).toEqual({ status: "set", value: "CP-7", provenance: "user-edited" });
    expect(data.pack.cover.version).toBe(3);
    expect(data.pack.cover.date).toBe("3 Sep 2026");
    expect(data.pack.printedOn).toBe("30 Sep 2026");
    expect(data.pack.printedOnIso).toBe("2026-09-30");
    expect(data.pack.cover.dateIso).toBe("2026-09-03");
  });

  it("lists the history newest first, with the dates in words and nobody recorded", () => {
    const data = page(start("crew-tee"));
    expect(data.pack.cover.revisions.map((entry) => [entry.version, entry.date, entry.by])).toEqual([
      [3, "3 Sep 2026", "Not recorded"],
      [2, "2 Sep 2026", "Not recorded"],
      [1, "1 Sep 2026", "Not recorded"],
    ]);
  });

  it("names who made each version from the brand's members, and no one else (owner decision 2026-09-30)", () => {
    const ADA = "11111111-1111-4111-8111-111111111111";
    const STRANGER = "33333333-3333-4333-8333-333333333333";
    const made = history(3);
    const withMakers: VersionsPage = {
      ...made,
      versions: made.versions.map((entry, index) => ({ ...entry, createdBy: [ADA, STRANGER, null][index] ?? null })),
    };
    const memberNames = new Map([[ADA, "Ada Lovelace"], ["22222222-2222-4222-8222-222222222222", "bob@example.com"]]);
    const data = page(start("crew-tee"), { history: withMakers, memberNames });
    expect(data.pack.cover.revisions.map((entry) => entry.by)).toEqual(["Ada Lovelace", "Not recorded", "Not recorded"]);
  });

  it("lists a run of quick edits by one person as one revision, under its newest version", () => {
    const ADA = "11111111-1111-4111-8111-111111111111";
    const quick: VersionsPage = {
      versions: [
        { version: 3, note: "Chest width set to 52 cm.", restoredFrom: null, createdAt: "2026-09-03T10:01:00Z", createdBy: ADA },
        { version: 2, note: "Body length set to 70 cm.", restoredFrom: null, createdAt: "2026-09-03T10:00:00Z", createdBy: ADA },
        { version: 1, note: "Design created.", restoredFrom: null, createdAt: "2026-09-01T10:00:00Z", createdBy: ADA },
      ],
      hasMore: false,
    };
    const data = page(start("crew-tee"), { history: quick, memberNames: new Map([[ADA, "Ada Lovelace"]]) });
    expect(data.pack.cover.revisions.map((entry) => [entry.version, entry.note, entry.by])).toEqual([
      [3, "Versions 2 to 3. The last change: Chest width set to 52 cm.", "Ada Lovelace"],
      [1, "Design created.", "Ada Lovelace"],
    ]);
  });

  it("dates a version older than the listed history by the day that version was saved, not the day the design last changed", () => {
    const old = project(start("crew-tee"), { currentVersion: 3, versionSavedAt: "2026-08-15T10:00:00Z", updatedAt: "2026-09-20T10:00:00Z" });
    const data = buildTechPackPage({
      project: old,
      history: { versions: [], hasMore: true },
      brandName: "Test Brand",
      images: new Map(),
      now: new Date("2026-09-30T10:00:00Z"),
    });
    expect(data.pack.cover.date).toBe("15 Aug 2026");
    expect(data.pack.cover.dateIso).toBe("2026-08-15");
  });

  it("says how many things are left to confirm, in a sentence", () => {
    const data = page(start("crew-tee"));
    expect(data.report.total).toBeGreaterThan(0);
    expect(data.sentence).toBe(`${data.report.total} things to confirm.`);
  });

  it("gives the two drawings as pictures with words for those who cannot see them", () => {
    const data = page(start("crew-tee"));
    expect(data.flats.map((flat) => flat.label)).toEqual(["Front", "Back"]);
    for (const flat of data.flats) {
      expect(flat.src).toMatch(/^data:image\/svg\+xml/);
      expect(flat.alt.length).toBeGreaterThan(10);
      expect(flat.toScale).toBe(false);
    }
  });

  it("draws the callouts with codes when the design is to scale", () => {
    const spec = designWith("crew-tee", {}, madeUpForType("crew-tee", {}));
    const data = page(spec);
    expect(data.flats.every((flat) => flat.toScale)).toBe(true);
    const svg = decodeURIComponent(data.flats[0]?.src?.split(",")[1] ?? "");
    expect(svg).toContain("A 52.0 cm");
    expect(svg).not.toContain("Chest width 52.0 cm");
  });

  it("gives no picture when the type has no drawing", () => {
    const data = page({ ...start("crew-tee"), typeId: "kilt" });
    expect(data.flats.every((flat) => flat.src === null)).toBe(true);
  });

  it("gives the forms what each shows, from the design", () => {
    const data = page(start("polo"));
    expect(data.forms.fabrics[0]?.id).toBe("main");
    expect(data.forms.components.map((row) => row.slotId)).toContain("buttons");
    expect(data.forms.seams[0]?.seamId).toBe("shoulder-seam");
    expect(data.forms.labelling).toHaveLength(5);
    expect(data.forms.panels.map((row) => row.panelId)).toContain("collar");
    expect(data.forms.measurements.map((row) => row.pointId)).toContain("chest-width");
    expect(data.forms.colourways[0]?.panels.map((panel) => panel.panelId)).toContain("collar");
    expect(data.forms.cover).toMatchObject({ sizesText: "", baseSize: "", sizesSet: false });
    expect(data.spec).toEqual(start("polo"));
  });

  it("lists what can be confirmed, and nothing the person typed", () => {
    const data = page(start("polo"));
    expect(data.confirmables.some((entry) => entry.sectionId === "construction")).toBe(true);
    expect(data.confirmables.every((entry) => entry.source !== "Typed in by you")).toBe(true);
  });

  it("changes when a measurement changes, from one version of the design", () => {
    const spec = designWith("crew-tee", {}, madeUpForType("crew-tee", {}));
    const result = applyAction(spec, { type: "set-measurement", pointId: "chest-width", value: 5600, provenance: "user-edited" });
    if (!result.ok) throw new Error(result.reason);
    const before = page(spec);
    const after = page(result.spec);
    expect(after.flats[0]?.src).not.toBe(before.flats[0]?.src);
    expect(JSON.stringify(after.pack.measurements)).not.toBe(JSON.stringify(before.pack.measurements));
  });

  it("carries the note about pictures that could not be shown", () => {
    expect(page(start("crew-tee"), { picturesNote: "One picture is not shown." }).picturesNote).toBe("One picture is not shown.");
    expect(page(start("crew-tee")).picturesNote).toBeNull();
  });

  it("never lists a version newer than the design that was read, so the page shows no mix", () => {
    const newer: VersionsPage = { versions: [{ version: 4, note: "Newer.", restoredFrom: null, createdAt: "2026-09-04T10:00:00Z" }, ...history(3).versions], hasMore: false };
    const data = page(start("crew-tee"), { history: newer });
    expect(data.pack.cover.revisions.map((entry) => entry.version)).toEqual([3, 2, 1]);
    expect(data.pack.cover.version).toBe(3);
  });

  it("says so when the history is newer than the design that was read", () => {
    const newer: VersionsPage = { versions: [{ version: 4, note: "Newer.", restoredFrom: null, createdAt: "2026-09-04T10:00:00Z" }, ...history(3).versions], hasMore: false };
    expect(page(start("crew-tee"), { history: newer }).staleNote).toBe(STALE_SENTENCE);
    expect(page(start("crew-tee")).staleNote).toBeNull();
  });
});

describe("historyIsNewer", () => {
  it("is true only when some saved version is newer than the design that was read", () => {
    expect(historyIsNewer(project(start("crew-tee")), history(3))).toBe(false);
    expect(historyIsNewer(project(start("crew-tee")), history(4))).toBe(true);
    expect(historyIsNewer(project(start("crew-tee")), { versions: [], hasMore: false })).toBe(false);
  });
});

describe("buildPackFor", () => {
  const input = (spec: GarmentSpec, patch: Partial<Parameters<typeof buildPackFor>[0]> = {}) => ({
    project: project(spec),
    history: history(3),
    brandName: "Test Brand",
    images: new Map(),
    now: new Date("2026-09-30T10:00:00Z"),
    ...patch,
  });

  it("is the document the page shows, so an export made from it cannot disagree with the screen", () => {
    const spec = designWith("crew-tee", {}, madeUpForType("crew-tee", {}));
    expect(buildPackFor(input(spec))).toEqual(buildTechPackPage(input(spec)).pack);
  });

  it("draws the colourway that is named, and the first when none is", () => {
    const spec = applyAction(designWith("crew-tee", {}, madeUpForType("crew-tee", {})), {
      type: "add-colourway",
      colourway: { id: "away", name: "Away", colours: [{ panelId: "body-front", colour: "White", swatch: "#ffffff", provenance: "user-edited" }] },
    });
    if (!spec.ok) throw new Error(spec.reason);
    const named = buildPackFor(input(spec.spec, { colourwayId: "away" }));
    const first = buildPackFor(input(spec.spec));
    expect(named.flats.views[0]?.model?.colourwayId).toBe("away");
    expect(first.flats.views[0]?.model?.colourwayId).toBe("main");
    expect(buildPackFor(input(spec.spec, { colourwayId: "nothing-like-it" })).flats.views[0]?.model?.colourwayId).toBe("main");
  });

  it("gives the page one drawing for each colourway, whichever colourway the flats show", () => {
    const spec = applyAction(designWith("crew-tee", {}, madeUpForType("crew-tee", {})), {
      type: "add-colourway",
      colourway: { id: "away", name: "Away", colours: [{ panelId: "body-front", colour: "White", swatch: "#ffffff", provenance: "user-edited" }] },
    });
    if (!spec.ok) throw new Error(spec.reason);
    const data = buildTechPackPage(input(spec.spec, { colourwayId: "away" }));
    expect(data.colourwayFlats.map((picture) => [picture.colourwayId, picture.label])).toEqual([
      ["main", "Main colourway, front"],
      ["away", "Away, front"],
    ]);
    expect(data.colourwayFlats.every((picture) => picture.src?.startsWith("data:image/svg+xml"))).toBe(true);
    expect(data.colourwayFlats[0]?.src).not.toBe(data.colourwayFlats[1]?.src);
  });

  it("reads the version it was given, whatever is newer in the history", () => {
    const spec = start("crew-tee");
    const old = buildPackFor(input(spec, { project: project(spec, { currentVersion: 1 }) }));
    expect(old.cover.version).toBe(1);
    expect(old.cover.revisions.map((entry) => entry.version)).toEqual([1]);
  });
});
