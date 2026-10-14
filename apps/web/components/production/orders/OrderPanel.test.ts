import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ projectId: "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11" }) }));

import { OrderPanel } from "./OrderPanel";
import { OrderEditor } from "./OrderEditor";
import { RosterTable } from "./RosterTable";
import { IssueList } from "./IssueList";
import { ReleasePanel } from "../release/ReleasePanel";
import { blankRow } from "./types";

const context = { run: ["S", "M"], hasNamePlace: true };
const wording = /\b(checked|verified|approved|confirmed|final|production[- ]ready|passed|validated|certified)\b/i;

describe("the team orders panel", () => {
  it("says what it is for and shows the releases part for an open design", () => {
    const html = renderToStaticMarkup(createElement(OrderPanel));
    expect(html).toContain("team-orders-heading");
    expect(html).toContain("Loading team lists.");
    expect(html).toContain("releases-heading");
    expect(html).not.toMatch(wording);
  });
  it("tells the person freezing a release is not available until the other parts are set up", () => {
    const html = renderToStaticMarkup(createElement(ReleasePanel, { projectId: "p", inputs: null }));
    expect(html).toContain("not available yet");
    expect(html).not.toMatch(wording);
  });
  it("offers a label field and the freeze button once the settings are supplied", () => {
    const inputs = { orderId: null, patternBlockId: "b", patternBlockVersion: 1, fabricTestIds: [], printProfile: {}, files: [] };
    const html = renderToStaticMarkup(createElement(ReleasePanel, { projectId: "p", inputs }));
    expect(html).toContain("Freeze a release");
    expect(html).toContain("can never be changed or removed");
  });
});

describe("the roster table", () => {
  const rows = [{ ...blankRow(context), name: "OKAFOR", number: "7" }];
  it("labels every cell with its row", () => {
    const html = renderToStaticMarkup(createElement(RosterTable, { rows, context, issues: [], onChange: () => undefined }));
    expect(html).toContain('aria-label="Name, row 1"');
    expect(html).toContain('aria-label="Number, row 1"');
    expect(html).toContain('aria-label="Size, row 1"');
  });
  it("leaves out the name column when the design prints no name", () => {
    const html = renderToStaticMarkup(createElement(RosterTable, { rows, context: { ...context, hasNamePlace: false }, issues: [], onChange: () => undefined }));
    expect(html).not.toContain("Name, row 1");
  });
  it("marks a row with a problem", () => {
    const html = renderToStaticMarkup(createElement(RosterTable, { rows, context, issues: [{ row: 1, severity: "error", message: "m" }], onChange: () => undefined }));
    expect(html).toContain("data-flagged");
  });
});

describe("the issue list", () => {
  it("shows things to fix before things to know, with the row", () => {
    const html = renderToStaticMarkup(createElement(IssueList, { issues: [{ row: 2, severity: "warning", message: "note" }, { row: 3, severity: "error", message: "Number 10 is used twice." }] }));
    expect(html.indexOf("1 thing to fix")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("Row 3: Number 10")).toBeLessThan(html.indexOf("Row 2: note"));
  });
  it("shows nothing for no issues", () => {
    expect(renderToStaticMarkup(createElement(IssueList, { issues: [] }))).toBe("");
  });
});

describe("the editor", () => {
  it("shows the problems found as the list stands and says names are personal data", () => {
    const rows = [
      { name: "A", number: "10", sizeLabel: "M", cut: "mens" as const, quantity: 1 },
      { name: "B", number: "10", sizeLabel: "9XL", cut: "mens" as const, quantity: 1 },
    ];
    const html = renderToStaticMarkup(createElement(OrderEditor, { projectId: "p", context, draft: { id: null, name: "T", rows }, onSaved: () => undefined, onClose: () => undefined }));
    expect(html).toContain("Number 10 is used by rows 1, 2");
    expect(html).toContain("not one of the sizes you make");
    expect(html).toContain("personal data");
    expect(html).not.toMatch(wording);
  });
});
