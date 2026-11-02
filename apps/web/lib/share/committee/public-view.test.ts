import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { ONE_VERSION_NOTE } from "./fields";
import { buildCommitteePage, lockedNote, type CommitteePageInput } from "./public-view";

const option = (slot: "A" | "B" | "C", version: number, patch: Partial<CommitteePageInput["options"][number]> = {}) => ({
  slot,
  version,
  savedAt: "2026-11-01T09:00:00Z",
  isCurrent: slot === "A",
  spec: start("crew-tee"),
  images: new Map(),
  picturesNote: null,
  ...patch,
});

const input = (patch: Partial<CommitteePageInput> = {}): CommitteePageInput => ({
  projectName: "Home kit 2027",
  brandName: "Northside Hockey Club",
  expiresAt: "2026-12-01T00:00:00Z",
  lockedVersion: null,
  options: [option("A", 4), option("B", 3)],
  ...patch,
});

describe("buildCommitteePage", () => {
  it("draws every option the link shows, with the front and the back", () => {
    const page = buildCommitteePage(input());

    expect(page.options.map((entry) => entry.label)).toEqual(["Option A", "Option B"]);
    expect(page.options[0]?.preview?.views.map((view) => view.view)).toEqual(["front", "back"]);
    expect(page.options[0]?.preview?.views[0]?.src.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("gives the outline the read-only 3D view is made from, and the size a pin is measured against", () => {
    const page = buildCommitteePage(input());
    const first = page.options[0];

    expect(first?.preview?.shape.front.outline.silhouette.length).toBeGreaterThan(0);
    expect(first?.bounds.widthMm).toBeGreaterThan(0);
    expect(first?.bounds.heightMm).toBeGreaterThan(0);
  });

  it("names the panels a pin may be put on", () => {
    const panels = buildCommitteePage(input()).options[0]?.panels ?? [];

    expect(panels.length).toBeGreaterThan(0);
    for (const panel of panels) expect(panel.id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it("shows the club's name, the design's name and the day the link runs out", () => {
    const page = buildCommitteePage(input());

    expect(page).toMatchObject({ designName: "Home kit 2027", brandName: "Northside Hockey Club" });
    expect(page.expiresOn).toMatch(/2026/);
  });

  it("says there is nothing to choose between when one version was shared", () => {
    expect(buildCommitteePage(input({ options: [option("A", 4)] })).oneOptionNote).toBe(ONE_VERSION_NOTE);
    expect(buildCommitteePage(input()).oneOptionNote).toBeNull();
  });

  it("marks the locked version and says plainly that the choice is made", () => {
    const page = buildCommitteePage(input({ lockedVersion: 3 }));

    expect(page.lockedNote).toBe(lockedNote(3));
    expect(page.options.map((entry) => entry.locked)).toEqual([false, true]);
  });

  it("has no size and no drawing for a garment nothing can be drawn for", () => {
    // A spec whose type the registry does not know has no panels and no drawing.
    const unknown = { ...start("crew-tee"), typeId: "not-a-garment" };
    const page = buildCommitteePage(input({ options: [option("A", 4, { spec: unknown })] }));

    expect(page.options[0]?.preview).toBeNull();
    expect(page.options[0]?.bounds).toEqual({ widthMm: 0, heightMm: 0 });
    expect(page.options[0]?.panels).toEqual([]);
  });
});
