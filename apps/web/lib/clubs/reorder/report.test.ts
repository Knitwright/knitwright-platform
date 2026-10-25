import { describe, expect, it } from "vitest";
import type { ReleaseSnapshot, RosterRow } from "@/lib/production/contract";
import { rosterHash } from "@/lib/orders/hash";
import { reorderReport, NOT_COMPARED } from "./report";

const row = (name: string, number: string, sizeLabel: string): RosterRow => ({ name, number, sizeLabel, cut: "mens", quantity: 1 });
const PROFILE = { bleedMm: 15, dpi: 150, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" } as const;
const snapshot = (rows: readonly RosterRow[] | null, specVersion = 3): ReleaseSnapshot => ({
  specVersion,
  patternBlockId: "crew",
  patternBlockVersion: 1,
  fabricTestIds: [],
  printProfile: PROFILE,
  rosterHash: rows === null ? null : rosterHash(rows),
  files: [],
});

describe("reorderReport", () => {
  it("says nothing changed when the design and the list are the same", () => {
    const rows = [row("Ana", "10", "M")];
    const report = reorderReport(snapshot(rows), 3, rows);
    expect(report.differences).toEqual([]);
    expect(report.identical).toBe(true);
    expect(report.notCompared).toEqual(NOT_COMPARED);
  });

  it("names a changed design version", () => {
    const rows = [row("Ana", "10", "M")];
    const report = reorderReport(snapshot(rows, 3), 5, rows);
    expect(report.identical).toBe(false);
    expect(report.differences[0]).toMatchObject({ code: "design-version" });
    expect(report.differences[0]?.message).toContain("version 3");
  });

  it("names a changed team list without naming anyone", () => {
    const report = reorderReport(snapshot([row("Ana", "10", "M")]), 3, [row("Ana", "10", "L")]);
    expect(report.differences.map((d) => d.code)).toEqual(["team-list"]);
    expect(JSON.stringify(report)).not.toContain("Ana");
  });

  it("treats a release with no team list as changed once a list exists", () => {
    const report = reorderReport(snapshot(null), 3, [row("Ana", "10", "M")]);
    expect(report.differences.map((d) => d.code)).toEqual(["team-list"]);
  });

  it("says plainly that print files, pattern, fabric and print settings were not compared", () => {
    expect(NOT_COMPARED.join(" ")).toMatch(/not compared|not checked/i);
    expect(NOT_COMPARED.length).toBeGreaterThan(0);
  });
});
