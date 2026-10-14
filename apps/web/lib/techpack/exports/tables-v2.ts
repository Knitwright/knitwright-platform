import type { TechPack } from "../types";
import { EXCEL_SHEETS } from "./contents";
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

/** The sections added by tech pack v2: readiness, pattern and cutting, fabric, artwork and colour, order of work. */

export function readinessSection(pack: TechPack): ExportSection {
  const { readiness } = pack;
  return {
    id: "readiness",
    title: readiness.title,
    sheet: EXCEL_SHEETS.readiness,
    paragraphs: sentences(readiness.note, readiness.summary),
    tables: [
      table(
        null,
        [textColumn("Group"), textColumn("What"), textColumn("Done"), textColumn("Who acts")],
        readiness.groups.flatMap((group) =>
          group.items.map((entry) => [text(group.title), text(entry.sentence), text(entry.met ? "Yes" : "Not yet"), text(entry.met ? "" : entry.actorLabel)]),
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
  return { id: "pattern-and-cutting", title: s.title, sheet: EXCEL_SHEETS["pattern-and-cutting"], paragraphs: sentences(s.note, s.blockName === null ? null : `Pattern block: ${s.blockName}.`), tables };
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
    sheet: EXCEL_SHEETS.fabric,
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

export function artworkAndColourSection(pack: TechPack): ExportSection {
  const s = pack.artworkAndColour;
  const repeat = s.repeat;
  const tables: ExportTable[] = [
    table(
      "Colour standards",
      [textColumn("Colour"), textColumn("Role"), valueColumn("Name"), valueColumn("Factory code"), valueColumn("Screen colour (screen only)")],
      s.colours.map((row) => [text(row.id), text(row.role), value(row.name), value(row.factoryCode), value(row.screenColour)]),
      s.colourNote,
    ),
    ...(repeat === null
      ? []
      : [
          table("Repeat sizes", [textColumn("Item"), lengthColumn("Size")], [...repeat.lengths.map((row) => [text(row.label), length(row.measure)]), [text("Closest gap between two dots, edge to edge"), length(repeat.gap)]], repeat.checks.join(" ")),
          table("Repeat settings", [textColumn("Item"), valueColumn("Setting")], repeat.settings.map((row) => [text(row.label), value(row.setting)])),
        ]),
    table(
      "Zones and clear space",
      [textColumn("Zone"), textColumn("Piece"), lengthColumn("Clear space"), textColumn("Sizes")],
      s.zones.map((row) => [text(row.purpose), text(row.pieceName), length(row.clearSpace), text(row.sizes)]),
    ),
    table(
      "Placement on every size",
      [textColumn("Size"), textColumn("Zone"), textColumn("Piece"), lengthColumn("Down from the high point of shoulder or cap"), lengthColumn("Across from centre")],
      s.placements.map((row) => [text(row.size), text(row.zone), text(row.pieceName), length(row.down), length(row.across)]),
    ),
    table("Print rules", [textColumn("Rule"), valueColumn("Value")], s.printRules.map((row) => [text(row.label), value(row.text)])),
    table(
      "Settings the print files were made with",
      [textColumn("Piece"), textColumn("Size"), textColumn("For"), lengthColumn("Bleed"), numberColumn("Scale across", "times"), numberColumn("Scale down", "times")],
      s.printParameters.map((row) => [text(row.pieceName), text(row.size), text(row.player), length(row.bleed), number(row.scaleAcross), number(row.scaleDown)]),
      s.printParametersNote,
    ),
  ];
  return { id: "artwork-and-colour", title: s.title, sheet: EXCEL_SHEETS["artwork-and-colour"], paragraphs: sentences(s.note), tables };
}

export function operationsSection(pack: TechPack): ExportSection {
  const s = pack.operations;
  return {
    id: "operations",
    title: s.title,
    sheet: EXCEL_SHEETS.operations,
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
