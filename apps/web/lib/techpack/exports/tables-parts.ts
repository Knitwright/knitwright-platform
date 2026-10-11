import { PROVENANCE_LABELS } from "@/lib/garment";
import { PROPOSAL_WORDS } from "../text";
import type { TechPack } from "../types";
import { EXCEL_SHEETS } from "./contents";
import {
  classColumn,
  classed,
  length,
  lengthColumn,
  namesOf,
  number,
  numberColumn,
  table,
  text,
  textColumn,
  value,
  valueColumn,
  type Datum,
  type ExportSection,
  type ExportTable,
} from "./table-types";
import { sentences } from "./tables-front";

const COLOUR_HELP = "The colour code is what a factory uses. The screen colour only sets how the drawing looks.";

export function componentsSection(pack: TechPack): ExportSection {
  const { components } = pack;
  const fabrics = table(
    "Fabric",
    [
      textColumn("Used for"),
      valueColumn("Fabric"),
      valueColumn("Composition"),
      valueColumn("Construction"),
      numberColumn("Weight", "grams per square metre"),
      valueColumn("Finish"),
      valueColumn("Stretch"),
      valueColumn("Fabric used for one garment"),
    ],
    components.fabrics.map((line) => [
      text(namesOf(line.panels)),
      value(line.name),
      value(line.composition),
      value(line.construction),
      number(line.weight),
      value(line.finish),
      value(line.stretch),
      value(line.consumption),
    ]),
  );
  const others = table(
    "Rib, thread, labels and trims",
    [
      textColumn("Item"),
      textColumn("Kind"),
      valueColumn("Name"),
      valueColumn("Details"),
      valueColumn("Quantity"),
      textColumn("About this item"),
      valueColumn("Proposal"),
    ],
    components.others.map((line) => [
      text(line.label),
      text(line.kindLabel),
      value(line.name),
      value(line.details),
      value(line.quantity),
      text(sentences(line.help, line.note).join(" ")),
      value(line.proposalNote),
    ]),
  );
  return {
    id: "components",
    title: components.title,
    sheet: EXCEL_SHEETS.components,
    paragraphs: sentences(components.note),
    tables: [fabrics, others],
  };
}

export function constructionSection(pack: TechPack): ExportSection {
  const { construction } = pack;
  return {
    id: "construction",
    title: construction.title,
    sheet: EXCEL_SHEETS.construction,
    paragraphs: sentences(construction.note),
    tables: [
      table(
        null,
        [textColumn("Seam"), textColumn("Joins"), classColumn("Seam class"), classColumn("Stitch class"), valueColumn("Stitch density")],
        construction.seams.map((seam) => [
          text(seam.label),
          text(namesOf(seam.panels)),
          classed(seam.seamClass),
          classed(seam.stitchClass),
          value(seam.stitchDensity),
        ]),
      ),
    ],
  };
}

export function colourwaysSection(pack: TechPack): ExportSection {
  const { colourways } = pack;
  return {
    id: "colourways",
    title: colourways.title,
    sheet: EXCEL_SHEETS.colourways,
    paragraphs: sentences(colourways.note, COLOUR_HELP),
    tables: colourways.colourways.map((block) =>
      table(
        block.name,
        [textColumn("Part"), valueColumn("Colour code"), valueColumn("Screen colour")],
        block.rows.map((row) => [text(row.label), value(row.code), value(row.screenColour)]),
      ),
    ),
  };
}

export function artworkSection(pack: TechPack): ExportSection {
  const { artwork } = pack;
  const rows = artwork.items.map((item): readonly Datum[] => [
    value(item.name),
    value(item.panel),
    value(item.anchor),
    length(item.across),
    length(item.down),
    length(item.width),
    length(item.height),
    number(item.rotation),
    value(item.technique),
    value(item.content.kind === "text" ? item.content.text : item.content.description),
  ]);
  const columns = [
    valueColumn("Name"),
    valueColumn("Part"),
    valueColumn("Place"),
    lengthColumn("Across"),
    lengthColumn("Down"),
    lengthColumn("Width"),
    lengthColumn("Height"),
    numberColumn("Turn", "degrees"),
    valueColumn("How it is made"),
    valueColumn("Shows"),
  ];
  return {
    id: "artwork",
    title: artwork.title,
    sheet: EXCEL_SHEETS.artwork,
    paragraphs: sentences(artwork.note, artwork.playerMarksNote),
    tables: [...(rows.length > 0 ? [table(null, columns, rows)] : []), ...playerMarksTables(pack)],
  };
}

const PLAYER_MARK_COLUMNS = [
  valueColumn("Place"),
  valueColumn("Part"),
  valueColumn("Anchor"),
  valueColumn("Shows"),
  lengthColumn("Height"),
  valueColumn("Lettering style"),
  valueColumn("Colour code"),
  valueColumn("Screen colour"),
  valueColumn("How it is made"),
];

/** Player names and numbers, one row for each place (decision 0027). None when the design has none. */
function playerMarksTables(pack: TechPack): ExportTable[] {
  const rows = pack.artwork.playerMarks.map((item): readonly Datum[] => [
    value(item.place),
    value(item.panel),
    value(item.anchor),
    value(item.shows),
    length(item.height),
    value(item.style),
    value(item.colour),
    value(item.screenColour),
    value(item.technique),
  ]);
  return rows.length > 0 ? [table("Player names and numbers", PLAYER_MARK_COLUMNS, rows)] : [];
}

export function labellingSection(pack: TechPack): ExportSection {
  const { labelling } = pack;
  return {
    id: "labelling",
    title: labelling.title,
    sheet: EXCEL_SHEETS.labelling,
    paragraphs: sentences(labelling.note),
    tables: [table(null, [textColumn("Field"), valueColumn("Entry")], labelling.rows.map((row) => [text(row.label), value(row.value)]))],
  };
}

const SUGGESTION_COLUMNS = [textColumn("Section"), textColumn("Item"), textColumn("Where it came from"), textColumn("Values covered")];

export function suggestedSection(pack: TechPack): ExportSection {
  const { suggested } = pack;
  const rowOf = (item: (typeof suggested.items)[number], words: string): readonly Datum[] => [
    text(item.sectionTitle),
    text(item.label),
    text(words),
    text(String(item.cells)),
  ];
  const items: readonly ExportTable[] =
    suggested.items.length === 0
      ? []
      : [table(null, SUGGESTION_COLUMNS, suggested.items.map((item) => rowOf(item, PROVENANCE_LABELS[item.provenance])))];
  const proposals = table(
    "Proposed by Knitwright",
    SUGGESTION_COLUMNS,
    suggested.proposals.map((item) => rowOf(item, PROPOSAL_WORDS)),
    suggested.proposalsNote,
  );
  return {
    id: "suggested",
    title: suggested.title,
    sheet: EXCEL_SHEETS.suggested,
    paragraphs: sentences(suggested.note),
    tables: [...items, proposals],
  };
}

export function signOffSection(pack: TechPack): ExportSection {
  const section = pack.signOff;
  return {
    id: "sign-off",
    title: section.title,
    sheet: EXCEL_SHEETS["sign-off"],
    paragraphs: sentences(section.note, section.statement),
    tables: [
      table(
        null,
        [textColumn("Field"), valueColumn("Value")],
        [
          [text("Name"), value(section.name)],
          [text("Date"), value(section.date)],
        ],
      ),
    ],
  };
}
