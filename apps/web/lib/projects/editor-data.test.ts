import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { buildEditorData } from "./editor-data";
import type { OpenProject, VersionSummary } from "./service";

const project = (overrides: Partial<OpenProject> = {}): OpenProject => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Home shirt",
  styleNumber: "HS-01",
  season: "SS27",
  garmentType: "crew-tee",
  garmentLabel: "Crew neck tee",
  currentVersion: 3,
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-29T14:05:00Z",
  spec: start("crew-tee", "women"),
  dropped: [],
  ...overrides,
});

const versions: readonly VersionSummary[] = [
  { version: 3, note: "Fit changed to Slim.", restoredFrom: null, createdAt: "2026-09-29T14:05:00Z" },
  { version: 2, note: "Restored version 1.", restoredFrom: 1, createdAt: "2026-09-28T09:30:00Z" },
  { version: 1, note: "Design created.", restoredFrom: null, createdAt: "2026-09-01T10:00:00Z" },
];

const page = (list: readonly VersionSummary[], hasMore = false) => ({ versions: [...list], hasMore });

describe("buildEditorData", () => {
  it("names the design, its type and who it is for", () => {
    const data = buildEditorData(project(), page(versions));

    expect(data).toMatchObject({
      projectId: "11111111-1111-4111-8111-111111111111",
      name: "Home shirt",
      styleNumber: "HS-01",
      season: "SS27",
      typeLabel: "Crew neck tee",
      wearerLabel: "Women",
      version: 3,
    });
  });

  it("builds a control for every option and a table for the measurements", () => {
    const data = buildEditorData(project(), page(versions));

    expect(data.controls.length).toBeGreaterThan(0);
    expect(data.table.groups.length).toBeGreaterThan(0);
  });

  it("draws the design, lists a colour row for each panel and shows where artwork can go", () => {
    const data = buildEditorData(project(), page(versions));

    expect(data.flat?.views.map((view) => view.label)).toEqual(["Front", "Back"]);
    expect(data.flat?.notice).toBe("Not to scale. Some measurements are missing.");
    expect(data.colours.map((row) => row.label)).toContain("Body front");
    expect(data.artwork).toEqual([]);
    expect(data.parts.map((part) => part.panelId)).toEqual(["body-front", "body-back", "sleeve-left", "sleeve-right"]);
  });

  it("marks the current version and writes each date in words", () => {
    const data = buildEditorData(project(), page(versions));

    expect(data.versions.map((entry) => [entry.version, entry.isCurrent])).toEqual([
      [3, true],
      [2, false],
      [1, false],
    ]);
    expect(data.versions[0].when).toBe("29 Sep 2026, 14:05 UTC");
    expect(data.versions[1]).toMatchObject({ note: "Restored version 1.", restoredFrom: 1 });
  });

  it("offers no undo for the first version, and undoes to the one before otherwise", () => {
    expect(buildEditorData(project({ currentVersion: 1 }), page(versions.slice(2))).undoTo).toBeNull();
    expect(buildEditorData(project(), page(versions)).undoTo).toBe(2);
  });

  it("undoes further back after an undo, and stops at the first design", () => {
    const made = (version: number, restoredFrom: number | null): VersionSummary => ({
      version,
      note: "Note.",
      restoredFrom,
      createdAt: "2026-09-29T14:05:00Z",
    });
    const afterUndo = [made(4, 2), made(3, null), made(2, null), made(1, null)];
    const afterTwo = [made(5, 1), ...afterUndo];

    expect(buildEditorData(project({ currentVersion: 4 }), page(afterUndo)).undoTo).toBe(1);
    expect(buildEditorData(project({ currentVersion: 5 }), page(afterTwo)).undoTo).toBeNull();
  });

  it("says when older versions exist that are not listed", () => {
    expect(buildEditorData(project(), page(versions)).olderVersionsHidden).toBe(false);
    expect(buildEditorData(project(), page(versions, true)).olderVersionsHidden).toBe(true);
  });

  it("has an empty sizes form for a design with no sizes", () => {
    expect(buildEditorData(project(), page(versions)).sizes).toEqual({ text: "", baseSize: "", set: false });
  });

  it("fills the sizes form from the design's sizes", () => {
    const spec = { ...start("crew-tee", "women"), sizing: { sizes: ["S", "M", "L"], baseSize: "M" } };

    expect(buildEditorData(project({ spec }), page(versions)).sizes).toEqual({
      text: "S, M, L",
      baseSize: "M",
      set: true,
    });
  });

  it("carries what a repair removed, so the person can be told", () => {
    const dropped = [{ kind: "option", id: "hem-shape", message: "Hem shape went back to straight." }] as const;

    expect(buildEditorData(project({ dropped }), page(versions)).dropped).toEqual(dropped);
  });
});
