import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { jersey } from "@/lib/editor/fixtures/article";
import type { EditorCommands, EditorDesign } from "@/lib/editor/slots";
import { DEV_CLUB } from "@/lib/garment-studio/fixtures/dev";
import { SHELVES, type ShelfId } from "@/lib/garment-studio/shelves";
import { start } from "@/lib/garment/fixtures/specs";
import { LibraryColumn } from "./LibraryColumn";
import { ShelfPanel } from "./ShelfPanel";
import { StudioExport } from "./StudioExport";

/**
 * Garment Studio's panels as the server first draws them (decision 0150): every library entry has a
 * panel with its own heading, the Export panel carries Fabra's six tabs and the eight-section
 * checklist, and Export on the Free plan is the upgrade, not a download.
 */

const design: EditorDesign = {
  projectId: "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11",
  version: 3,
  spec: start("team-jersey", "men"),
  article: jersey(),
  form: { options: {}, parameters: {} },
  size: "M",
  sizes: ["S", "M", "L"],
  colourwayId: "main",
  draft: null,
  busy: false,
};
const commands = {} as EditorCommands;
const noop = () => undefined;
const html = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(element).replaceAll("&#x27;", "'");

describe("the library column", () => {
  const column = html(
    createElement(LibraryColumn, { projectId: design.projectId, clubName: "Lahore Lions FC", shelf: "colours", onShelf: noop, segment: null, onSegment: noop, onAssistant: noop, assistantOpen: false }),
  );

  it("switches to the tech pack page, keeps the three toolbars and names the club", () => {
    expect(column).toContain(`href="/studio/${design.projectId}/tech-pack"`);
    expect(column).toContain('aria-label="Toolbars"');
    expect(column).toContain("Lahore Lions FC");
    expect(column).toContain(">LL<");
  });

  it("marks the open library entry pressed, and Repeat prints as paid", () => {
    expect(column).toMatch(/aria-pressed="true"[^>]*data-testid="studio-shelf-colours"/);
    expect(column).toContain('aria-label="Premium tool"');
    expect(column).toContain("Ask Knitwright");
  });
});

const SKIP: readonly ShelfId[] = ["repeat-prints"];

describe("the library panels", () => {
  it.each(SHELVES.filter((id) => !SKIP.includes(id)))("draws %s with its title and a close button", (shelf) => {
    const panel = html(createElement(ShelfPanel, { shelf, slot: { design, commands }, club: DEV_CLUB, onTool: noop, onClose: noop }));
    expect(panel).toContain(`data-testid="studio-panel-${shelf}"`);
    expect(panel).toMatch(/aria-label="Close [^"]+"/);
  });

  it("lists the base's approved fabrics, with Fabra's chips and the search box", () => {
    const panel = html(createElement(ShelfPanel, { shelf: "fabrics", slot: { design, commands }, club: DEV_CLUB, onTool: noop, onClose: noop }));
    expect(panel).toContain('aria-label="Search fabrics"');
    for (const chip of ["Polyester", "Mesh", "Interlock", "Recycled"]) expect(panel).toContain(chip);
    expect(panel).toContain("Only fabrics the factory stocks");
  });

  it("draws the club's colours before the print-safe ones", () => {
    const panel = html(createElement(ShelfPanel, { shelf: "colours", slot: { design, commands }, club: DEV_CLUB, onTool: noop, onClose: noop }));
    expect(panel.indexOf("studio-club-colours")).toBeLessThan(panel.indexOf("studio-print-safe"));
    expect(panel).toContain("background-color:#f2b705");
  });

  it("says what a club with nothing on file has not got yet, and links to Brand", () => {
    const empty = { name: "New club", palettes: [], uploads: [] };
    const palettes = html(createElement(ShelfPanel, { shelf: "palettes", slot: { design, commands }, club: empty, onTool: noop, onClose: noop }));
    expect(palettes).toContain("none on file yet");
    expect(palettes).toContain('href="/brand"');
  });
});

describe("the Export panel", () => {
  const panel = html(createElement(StudioExport, { design, onClose: noop, onAllFiles: noop }));

  it("has the six tabs and the eight sections, with the order note", () => {
    for (const tab of ["Tech pack", "Images", "Pattern", "Artwork", "On model", "Flat lay"]) expect(panel).toContain(`>${tab}</button>`);
    expect(panel).toContain("Export tech pack");
    expect(panel).toContain("Compliance labels");
    expect(panel).toContain("You don't need to export");
    expect(panel).toContain(`href="/studio/${design.projectId}/tech-pack"`);
  });

  it("makes Export on the Free plan the upgrade, marked ♛, rather than a download", () => {
    expect(panel).toMatch(/<button[^>]*data-testid="studio-export-go"/);
    expect(panel).toContain("Needs a plan with tech pack exports; you are on Free");
  });
});
