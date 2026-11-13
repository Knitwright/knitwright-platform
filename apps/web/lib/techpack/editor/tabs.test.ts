import { describe, expect, it } from "vitest";
import { input } from "../view/fixtures/views";
import { buildTechPackView } from "../view/model";
import { TECHPACK_TABS } from "../view/tabs";
import { EDITOR_TABS, EDITOR_TAB_LABELS, editorTabOf, editorTabOr, foldTabs, isEditorTab } from "./tabs";

const view = () => buildTechPackView(input());

describe("the seven tabs of the v3.9 tech pack editor", () => {
  it("are the seven spec screen 30 names, in order", () => {
    expect(EDITOR_TABS.map((id) => EDITOR_TAB_LABELS[id])).toEqual(["Overview", "Body", "Measurements", "Materials", "Callouts", "Artworks", "Labels"]);
  });

  it("draw every section of all eleven v2.2 tabs exactly once, so nothing is lost", () => {
    const tabs = view().tabs;
    const before = tabs.flatMap((entry) => entry.sections.map((part) => `${entry.id}/${part.id}`));
    const after = foldTabs(tabs).flatMap((entry) => entry.parts.flatMap((part) => part.sections.map((section) => `${part.from}/${section.id}`)));
    expect([...after].sort()).toEqual([...before].sort());
  });

  it("fold the dropped tabs in under their old names", () => {
    const folded = foldTabs(view().tabs);
    const headings = (id: string) => folded.find((entry) => entry.id === id)?.parts.map((part) => part.heading);
    expect(headings("materials")).toEqual([null, "Colourways"]);
    expect(headings("artworks")).toEqual([null, "Names & numbers"]);
    expect(headings("measurements")).toEqual([null, "Quality control"]);
    expect(headings("overview")).toEqual([null, "Still to fill"]);
  });

  it("send every v2.2 tab name to a v3.9 tab", () => {
    for (const id of TECHPACK_TABS) expect(EDITOR_TABS).toContain(editorTabOf(id));
    expect(editorTabOf("review")).toBe("overview");
  });

  it("read a tab from an address, old names included", () => {
    expect(editorTabOr("callouts")).toBe("callouts");
    expect(editorTabOr("qc")).toBe("measurements");
    expect(editorTabOr("colourways")).toBe("materials");
    expect(editorTabOr("nonsense")).toBe("overview");
    expect(editorTabOr(null)).toBe("overview");
    expect(editorTabOr(undefined)).toBe("overview");
    expect(isEditorTab("labels")).toBe(true);
    expect(isEditorTab("review")).toBe(false);
  });

  it("use the tab's own label when a folded tab has no heading of its own", () => {
    const folded = foldTabs([{ id: "body", label: "Body", lead: "", sections: [] }, { id: "labels", label: "Labels", lead: "", sections: [] }]);
    expect(folded.find((entry) => entry.id === "body")?.parts).toHaveLength(1);
  });
});
