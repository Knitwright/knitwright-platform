import { describe, expect, it } from "vitest";
import { fromBase, fromDesign, needsInput } from "./fields";
import { article, input } from "./fixtures/views";
import { buildMeasurements } from "./measurements";
import { buildTechPackView } from "./model";
import { EXPORT_BLOCKED_REASON, buildReview } from "./review";
import { section, tab, table, type TabView, type ViewTable } from "./rows";

/**
 * Spec F-S6's Review tab: "Every field still 'Needs your input', plus the F-G2 pre-export check.
 * Export is blocked until clear; no `[TBC]` is allowed."
 */

const poms = () => buildMeasurements({ article: article(), sizes: article().sizeRange, extras: [], mode: "measurement", unit: "mm" }).rows;

const fullBom = (): readonly ViewTable[] => [
  table({
    id: "fabrics",
    title: "Fabrics",
    columns: ["Description"],
    rows: [{ id: "f", label: "Body", cells: [fromBase({ id: "f-d", label: "Description", text: "Interlock" })] }],
  }),
];

const emptyTab = (id: "labels" | "qc", cells: readonly ReturnType<typeof fromDesign>[]): TabView =>
  tab(id, [section({ id: "s", title: "S", fields: cells })]);

const review = (patch: Partial<Parameters<typeof buildReview>[0]> = {}) =>
  buildReview({
    tabs: [emptyTab("labels", [fromDesign({ id: "l", label: "Care instructions", text: "Wash at 30" })])],
    poms: poms(),
    sizes: article().sizeRange,
    bomTables: fullBom(),
    ...patch,
  });

describe("the F-G2 pre-export check", () => {
  it("runs the nine items of F-G2, in one order every time", () => {
    expect(review().checks.map((check) => check.id)).toEqual(["fields", "tbc", "poms", "bom", "labels", "gamut", "dpi", "bleed", "moderation"]);
  });

  it("is clear and lets the export through when nothing is waiting", () => {
    const view = review();
    expect(view.items).toEqual([]);
    expect(view.exportBlocked).toBe(false);
    expect(view.summary).toBe("Nothing on this tab stops the export.");
  });

  it("blocks, and names the first field, while a field is waiting", () => {
    const view = review({ tabs: [emptyTab("labels", [needsInput({ id: "l", label: "Care instructions", ruleId: "R-LAB-002" })])] });
    expect(view.items.map((item) => item.label)).toEqual(["Care instructions"]);
    expect(view.items[0]?.tabLabel).toBe("Labels & packaging");
    expect(view.exportBlocked).toBe(true);
    expect(view.checks[0]?.state).toBe("blocked");
    expect(view.checks[0]?.detail).toContain("Care instructions");
  });

  it("counts the fields that are waiting rather than listing them all in one line", () => {
    const view = review({
      tabs: [emptyTab("labels", [needsInput({ id: "a", label: "One" }), needsInput({ id: "b", label: "Two" }), needsInput({ id: "c", label: "Three" })])],
    });
    expect(view.checks[0]?.detail).toContain("and 2 more");
    expect(view.summary).toContain("3 fields are waiting");
  });

  it("says one field in the singular", () => {
    const view = review({ tabs: [emptyTab("labels", [needsInput({ id: "a", label: "One" })])] });
    expect(view.summary).toBe("1 field is waiting for you; 2 checks stop the export.");
    expect(review({ tabs: [emptyTab("labels", [needsInput({ id: "a", label: "One" })])], poms: [] }).summary).toContain("3 checks stop the export");
  });

  it("refuses [TBC] wherever it is written, because F-G2 allows it nowhere", () => {
    const view = review({ tabs: [emptyTab("labels", [fromDesign({ id: "l", label: "Care instructions", text: "[TBC] by the factory" })])] });
    const tbc = view.checks.find((check) => check.id === "tbc");
    expect(tbc?.state).toBe("blocked");
    expect(tbc?.detail).toContain("Care instructions");
    expect(view.exportBlocked).toBe(true);
  });

  it("blocks when no point of measure is on the table at all", () => {
    const check = review({ poms: [] }).checks.find((entry) => entry.id === "poms");
    expect(check?.state).toBe("blocked");
    expect(check?.detail).toContain("No point of measure");
  });

  it("blocks a point of measure with no value in every size", () => {
    const broken = poms().map((row, index) => (index === 0 ? { ...row, values: row.values.map((value) => ({ ...value, text: null })) } : row));
    const check = review({ poms: broken }).checks.find((entry) => entry.id === "poms");
    expect(check?.state).toBe("blocked");
    expect(check?.detail).toContain("Point A has no value");
  });

  it("blocks a point of measure with no tolerance, and never fills one in", () => {
    const broken = poms().map((row, index) => (index === 0 ? { ...row, tolMinus: null } : row));
    const check = review({ poms: broken }).checks.find((entry) => entry.id === "poms");
    expect(check?.state).toBe("blocked");
    expect(check?.detail).toContain("no tolerance");
  });

  it("passes the points of measure of the seeded article, which has a value and a tolerance for each", () => {
    const check = review().checks.find((entry) => entry.id === "poms");
    expect(check?.state).toBe("clear");
    expect(check?.detail).toContain("12 point(s) of measure");
  });

  it("ignores an extra point of measure, which is the founder's own and is not graded", () => {
    const extra = { ...poms()[0], letter: "Q", isExtra: true, tolMinus: null, tolPlus: null, values: [] };
    expect(review({ poms: [...poms(), extra] }).checks.find((entry) => entry.id === "poms")?.state).toBe("clear");
  });

  it("blocks when the bill of materials has no fabric line", () => {
    expect(review({ bomTables: [] }).checks.find((entry) => entry.id === "bom")?.state).toBe("blocked");
    expect(review({ bomTables: [table({ id: "fabrics", title: "Fabrics", columns: [], rows: [] })] }).checks.find((entry) => entry.id === "bom")?.detail).toContain("no fabric line");
  });

  it("blocks a bill-of-materials line that is not filled in", () => {
    const half = [
      table({
        id: "fabrics",
        title: "Fabrics",
        columns: ["Description", "Code"],
        rows: [{ id: "f", label: "Body", cells: [fromBase({ id: "a", label: "Description", text: "Interlock" }), needsInput({ id: "b", label: "Code" })] }],
      }),
    ];
    const check = review({ bomTables: half }).checks.find((entry) => entry.id === "bom");
    expect(check?.state).toBe("blocked");
    expect(check?.detail).toContain("Fabrics: Body");
  });

  it("blocks when a label field is waiting, and clears when none is", () => {
    expect(review({ tabs: [emptyTab("labels", [needsInput({ id: "l", label: "Care" })])] }).checks.find((entry) => entry.id === "labels")?.state).toBe("blocked");
    expect(review().checks.find((entry) => entry.id === "labels")?.state).toBe("clear");
  });

  it("blocks when there is no Labels tab to read at all, and says so in the singular", () => {
    const view = review({ tabs: [emptyTab("qc", [])] });
    expect(view.checks.find((entry) => entry.id === "labels")?.state).toBe("blocked");
    expect(view.summary).toBe("0 fields are waiting for you; 1 check stops the export.");
  });

  it("says where the four items it cannot read are read instead, and never calls them clear", () => {
    const read = review().checks.filter((check) => check.state === "read-elsewhere");
    expect(read.map((check) => check.id)).toEqual(["gamut", "dpi", "bleed", "moderation"]);
    for (const check of read) expect(check.detail, check.id).toContain("not read on this tab");
  });

  it("does not let those four items block the export, because the export has its own gate", () => {
    expect(review().exportBlocked).toBe(false);
  });

  it("gives the Export panel one sentence to show while it is held", () => {
    expect(EXPORT_BLOCKED_REASON).toContain("Review tab");
  });
});

describe("the Review tab of a real design", () => {
  it("lists what is waiting across the tabs, and holds the export", () => {
    const view = buildTechPackView(input());
    expect(view.review.items.length).toBeGreaterThan(0);
    expect(view.review.exportBlocked).toBe(true);
    expect(new Set(view.review.items.map((item) => item.tabId))).toContain("personalisation");
  });

  it("names the tab each waiting field belongs to, so a person can go to it", () => {
    const view = buildTechPackView(input());
    for (const item of view.review.items) {
      expect(item.tabLabel.length, item.cellId).toBeGreaterThan(1);
      expect(item.ruleId, item.cellId).toMatch(/^R-[A-Z]+-[0-9]{3}$/);
    }
  });
});
