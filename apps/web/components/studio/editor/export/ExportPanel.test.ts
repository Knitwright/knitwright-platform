import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EditorCommands, EditorDesign, EditorDraft } from "@/lib/editor/slots";
import { fullDesign } from "@/lib/techpack/fixtures/designs";
import { PANEL_TABS } from "@/lib/techpack/exports/panel";
import ExportPanel from "./ExportPanel";

/**
 * The Export panel is a slot of the editor shell: it takes the design and the commands and nothing
 * else (spec F-S6, decision 0078). These tests render it as the server first draws it.
 */

const PROJECT = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";

const commands = {} as EditorCommands;

const design = (patch: Partial<EditorDesign> = {}): EditorDesign => ({
  projectId: PROJECT,
  version: 3,
  spec: fullDesign("crew-tee"),
  article: null,
  form: { options: {}, parameters: {} },
  size: "M",
  sizes: ["S", "M", "L"],
  colourwayId: "main",
  draft: null,
  busy: false,
  ...patch,
});

const draw = (patch: Partial<EditorDesign> = {}): string => renderToStaticMarkup(createElement(ExportPanel, { design: design(patch), commands }));

describe("the Export panel", () => {
  const html = draw();

  it("draws the preview and the specification's six tabs", () => {
    expect(html).toContain('data-testid="editor-export-panel"');
    expect(html).toContain('role="tablist"');
    for (const tab of PANEL_TABS) expect(html, tab.id).toContain(`id="export-tab-${tab.id}"`);
  });

  it("opens on the tech pack, and offers the PDF and the Excel file of the version the editor shows", () => {
    expect(html).toContain('data-testid="export-output-pdf"');
    expect(html).toContain('data-testid="export-output-xlsx"');
    expect(html).toContain(`/api/projects/${PROJECT}/exports/pdf?version=3&amp;colourway=main`);
  });

  it("lists what the two files hold, section by section", () => {
    expect(html).toContain('data-testid="export-sections"');
    for (const label of ["Overview", "Measurements", "Materials", "Callouts", "Colourways", "QC"]) expect(html, label).toContain(label);
  });

  it("says that the Review tab has not checked the version, rather than claiming the design is clear", () => {
    expect(html).toContain('data-testid="export-gate"');
    expect(html).toContain("Review tab has not checked this version");
    for (const word of ["approved", "verified", "production-ready", "certified", "validated", "ready to make"]) {
      expect(html.toLowerCase(), word).not.toContain(word);
    }
  });

  it("offers no address at all while the drafter refuses the form, so the gate cannot be worked around", () => {
    const refused: EditorDraft = {
      kind: "invalid",
      findings: [{ field: "body_length_delta", message: "Body length is outside the approved range.", ruleId: "R-PAT-005" }],
    };
    const shut = draw({ draft: refused });
    expect(shut).toContain('data-testid="export-shut"');
    expect(shut).not.toContain("/api/projects/");
    expect(shut).toContain("R-PAT-005");
  });

  it("draws a preview of this version from the design alone, and asks for nothing from the server", () => {
    expect(html).toMatch(/data-testid="export-preview(-none)?"/);
    // A slot never fetches: the panel builds its preview from the design it was handed.
    expect(html).not.toContain("/api/projects/none");
  });

  it("gives the links the design's own version, so a file is never of another version", () => {
    expect(draw({ version: 9 })).toContain("version=9");
  });

  it("disables the links while a save is in flight, rather than sending a file of a design that is changing", () => {
    expect(draw({ busy: true })).toContain('aria-disabled="true"');
  });
});
