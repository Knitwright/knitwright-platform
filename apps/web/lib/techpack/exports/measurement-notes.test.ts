import { describe, expect, it } from "vitest";
import { TBC } from "../cell";
import type { MeasureGroup, MeasureRow } from "../types";
import { measurementNotes } from "./measurement-notes";

const row = (code: string, label: string, notes: readonly string[]): MeasureRow => ({
  pointId: label.toLowerCase().replaceAll(" ", "-"),
  code,
  label,
  tolerance: TBC,
  values: [TBC],
  notes,
});

const group = (rows: readonly MeasureRow[]): MeasureGroup => ({ group: "body", label: "Body", rows });

const words = (groups: readonly MeasureGroup[]): string[][] =>
  (measurementNotes(groups)?.rows ?? []).map((entry) => entry.map((datum) => (datum.kind === "text" ? datum.text : "")));

describe("the notes on single measurements", () => {
  it("are none when no row has a note", () => {
    expect(measurementNotes([group([row("A", "Chest width", [])])])).toBeNull();
    expect(measurementNotes([])).toBeNull();
  });

  it("keep a note of one row as it is, with its code and its measurement", () => {
    expect(words([group([row("A", "Chest width", ["Chest width has no value. Type one in."])])])).toEqual([
      ["A", "Chest width", "Chest width has no value. Type one in."],
    ]);
  });

  it("say once, for all their codes, a note that rows share or that differs only in the name it starts with", () => {
    const groups = [
      group([
        row("A", "Chest width", ["Chest width has no value. Type one in.", "No size chart applies."]),
        row("B", "Body length", ["Body length has no value. Type one in.", "No size chart applies."]),
      ]),
      group([row("C", "Neck width", ["The chart has no size S, so Neck width is not filled in."])]),
    ];
    expect(words(groups)).toEqual([
      ["A, B", "Chest width, Body length", "Each of these has no value. Type one in."],
      ["A, B", "Chest width, Body length", "No size chart applies."],
      ["C", "Neck width", "The chart has no size S, so Neck width is not filled in."],
    ]);
  });

  it("never joins notes that name their measurement inside the sentence", () => {
    const groups = [
      group([
        row("A", "Chest width", ["The chart has no size S, so Chest width is not filled in."]),
        row("B", "Body length", ["The chart has no size S, so Body length is not filled in."]),
      ]),
    ];
    expect(words(groups)).toHaveLength(2);
  });

  it("are a table headed by code, measurement and note", () => {
    const notes = measurementNotes([group([row("A", "Chest width", ["A note."])])]);
    expect(notes?.title).toBe("Measurement notes");
    expect(notes?.columns.map((column) => column.header)).toEqual(["Code", "Measurement", "Note"]);
  });
});
