import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { buildEditorData } from "@/lib/projects/editor-data";
import type { OpenProject } from "@/lib/projects/service";
import { TOOLS } from "@/lib/workspace/tools";
import { PanelSection, type SectionContext, type WorkspaceSlots } from "./PanelSections";

/**
 * The section this branch added to the design workspace (decision 0124): the design-import panel in
 * the Garment tool, rendered the way the tool panel renders it, with no browser. What is checked is
 * what a person would see -- and nothing at all while the feature is switched off, since the slot is
 * filled on the server (decision 0038 item 7).
 */

const project: OpenProject = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Home shirt",
  styleNumber: "HS-01",
  season: "SS27",
  garmentType: "crew-tee",
  garmentLabel: "Crew neck tee",
  currentVersion: 3,
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-29T14:05:00Z",
  versionSavedAt: "2026-09-29T14:05:00Z",
  spec: start("crew-tee", "women"),
  dropped: [],
};

const slots = (over: Partial<WorkspaceSlots> = {}): WorkspaceSlots => ({
  kitStyles: null,
  share: null,
  photoreal: null,
  quote: null,
  organisation: null,
  designImport: null,
  ...over,
});

const context = (over: Partial<WorkspaceSlots> = {}): SectionContext => ({
  data: buildEditorData(project, { versions: [], hasMore: false }),
  // Neither of these two sections asks the editor for anything: one is a server slot, the other
  // reads its own rows through /api/artwork.
  editor: {} as SectionContext["editor"],
  assistantAvailable: false,
  slots: slots(over),
});

const render = (section: Parameters<typeof PanelSection>[0]["section"], over: Partial<WorkspaceSlots> = {}): string =>
  renderToStaticMarkup(createElement(PanelSection, { section, context: context(over) })).replaceAll("&#x27;", "'");

describe("the design-import section of the Garment tool", () => {
  it("is one of the Garment tool's sections, so the rail already opens it", () => {
    expect(TOOLS.garment.sections).toContain("design-import");
  });

  it("draws the panel the server handed it, under a heading that says what it does", () => {
    const html = render("design-import", { designImport: createElement("p", null, "the import panel") });
    expect(html).toContain("Read a whole design from a picture");
    expect(html).toContain("the import panel");
  });

  it("draws nothing at all, heading included, while the feature is switched off", () => {
    expect(render("design-import")).toBe("");
  });
});

/**
 * The brand's own artwork was tried here and taken out again (decision 0124): the Logos tool
 * already carries the older per-design logo upload, so the screen offered two uploads and two
 * rights consents for the same crest. Its screen is Brand Studio's Overview, where every picker
 * chooses from those same rows. This holds the tool to its one upload.
 */
describe("the artwork section of the Logos tool", () => {
  it("is the logos a person places on this design, and nothing else", () => {
    expect([...TOOLS.logos.sections]).toEqual(["artwork"]);
  });
});
