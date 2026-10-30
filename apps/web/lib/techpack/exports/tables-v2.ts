import type { TechPack } from "../types";
import {
  length,
  lengthColumn,
  number,
  numberColumn,
  table,
  text,
  textColumn,
  value,
  valueColumn,
  type ExportSection,
  type ExportTable,
} from "./table-types";
import { sentences } from "./tables-front";

export { artworkAndColourSection } from "./tables-artwork";

/** The sections added by tech pack v2: readiness, pattern and cutting, fabric, artwork and colour, order of work. */

export function readinessSection(pack: TechPack): ExportSection {
  const { readiness } = pack;
  return {
    id: "readiness",
    title: readiness.title,
    paragraphs: sentences(readiness.note, readiness.summary),
    tables: [
      table(
        null,
        [textColumn("Group"), textColumn("What"), textColumn("Done"), textColumn("Who acts"), textColumn("Open owner input and what is used until then")],
        readiness.groups.flatMap((group) =>
          group.items.map((entry) => [text(group.title), text(entry.sentence), text(entry.met ? "Yes" : "Not yet"), text(entry.met ? "" : entry.actorLabel), text(entry.ownerInput?.sentence ?? "")]),
        ),
      ),
    ],
  };
}

export function patternAndCuttingSection(pack: TechPack): ExportSection {
  const s = pack.patternAndCutting;
  const review = table(
    "Pattern",
    [textColumn("Field"), valueColumn("Value")],
    [[text("Review"), value(s.reviewStatus)]],
  );
  const tables: ExportTable[] =
    s.cutList.length === 0
      ? [review]
      : [
          review,
          table(
            "Cut list",
            [textColumn("Size"), valueColumn("Piece"), numberColumn("Quantity", "pieces"), valueColumn("How it is cut"), valueColumn("Grain"), valueColumn("Outline"), valueColumn("Notches"), numberColumn("Area cut", "square centimetres")],
            s.cutList.map((row) => [text(row.size), value(row.name), number(row.quantity), value(row.cut), value(row.grain), value(row.outline), value(row.notches), number(row.area)]),
          ),
          table(
            "Seam allowance on each edge",
            [textColumn("Size"), textColumn("Piece"), textColumn("Seam"), lengthColumn("Seam allowance"), textColumn("Where it came from")],
            s.seamAllowances.map((row) => [text(row.size), text(row.pieceName), text(row.seamId), length(row.allowance), text(row.sourceNote)]),
          ),
          table(
            "Fabric use",
            [textColumn("Size"), numberColumn("Area of all pieces", "square centimetres"), numberColumn("Fabric needed", "metres"), textColumn("How")],
            s.fabricUse.map((row) => [text(row.size), number(row.area), number(row.length), text(row.note)]),
            s.fabricUseNote,
          ),
        ];
  return { id: "pattern-and-cutting", title: s.title, paragraphs: sentences(s.note, s.blockName === null ? null : `Pattern block: ${s.blockName}.`), tables };
}

export function fabricSection(pack: TechPack): ExportSection {
  const s = pack.fabric;
  const percent = s.rows.filter((row) => row.id.startsWith("stretch") || row.id.startsWith("shrink") || row.id === "recovery");
  const single = (id: string, header: string, unit: string): ExportTable => {
    const row = s.rows.find((entry) => entry.id === id);
    return table(null, [textColumn("Property"), numberColumn(header, unit), textColumn("Where it came from")], row ? [[text(row.label), number(row.measure), text(row.sourceNote)]] : []);
  };
  return {
    id: "fabric",
    title: s.title,
    paragraphs: sentences(s.note, s.reductionNote, s.printScaleNote),
    tables: [
      table(
        "Stretch, recovery and shrink",
        [textColumn("Property"), numberColumn("Value", "percent"), textColumn("Where it came from")],
        percent.map((row) => [text(row.label), number(row.measure), text(row.sourceNote)]),
      ),
      single("gsm", "Value", "grams per square metre"),
      single("usable-width", "Value", "millimetres"),
      table(
        "Print scale",
        [textColumn("Direction"), numberColumn("Times larger", "times"), textColumn("Where it came from")],
        [
          [text("Along the length"), number(s.printScaleLength), text("Worked out from the shrink")],
          [text("Across the width"), number(s.printScaleWidth), text("Worked out from the shrink")],
        ],
      ),
    ],
  };
}

export function operationsSection(pack: TechPack): ExportSection {
  const s = pack.operations;
  return {
    id: "operations",
    title: s.title,
    paragraphs: sentences(s.note),
    tables: [
      table(null, [textColumn("Field"), valueColumn("Value")], [[text("Decoration method"), value(s.technique)]]),
      table(
        null,
        [textColumn("Step"), textColumn("Stage"), textColumn("What is done"), valueColumn("Source")],
        s.steps.map((step) => [text(String(step.order)), text(step.stageLabel), text(step.label), value(step.detail)]),
      ),
    ],
  };
}
