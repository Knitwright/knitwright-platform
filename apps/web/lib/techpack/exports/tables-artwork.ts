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
  type Datum,
  type ExportSection,
  type ExportTable,
} from "./table-types";
import { sentences } from "./tables-front";

type Artwork = TechPack["artworkAndColour"];

const RESULT_WORDS = { meets: "Meets the minimum", below: "Below the minimum", unknown: "Not known", vector: "Vector" } as const;

function colourTables(s: Artwork): ExportTable[] {
  return [
    table(
      "Colour standards",
      [textColumn("Colour"), textColumn("Role"), valueColumn("Name"), valueColumn("Factory code"), valueColumn("Screen colour (screen only)"), textColumn("Other codes, as typed")],
      s.colours.map((row) => [text(row.id), text(row.role), value(row.name), value(row.factoryCode), value(row.screenColour), text(row.otherCodes)]),
      s.colourNote,
    ),
  ];
}

function layerTables(s: Artwork): ExportTable[] {
  if (s.source === "legacy") return [];
  return [
    table(
      "Layers, bottom to top",
      [textColumn("Layer"), textColumn("Kind"), textColumn("Views"), textColumn("Zone or anchor"), textColumn("Method"), textColumn("Where it came from"), textColumn("Details")],
      s.layers.map((row) => [text(row.name), text(row.kind), text(row.views), text(row.where), text(row.technique), text(row.origin), text(row.detail)]),
    ),
    table(
      "Clear space around placed pictures",
      [textColumn("Layer"), textColumn("Zone or anchor"), lengthColumn("Clear space")],
      s.layers.flatMap((row) => (row.clearSpace === null ? [] : [[text(row.name), text(row.where), length(row.clearSpace)]])),
      "No pattern or colour of another layer is printed inside this space around the picture, when the picture is set to knock out.",
    ),
    table(
      "Placement of layers on every size",
      [textColumn("Layer"), textColumn("Size"), textColumn("View"), textColumn("Piece"), lengthColumn("Down from the high point of shoulder or cap"), lengthColumn("Across from centre")],
      s.layerPlacements.map((row) => [text(row.layer), text(row.size), text(row.view), text(row.pieceName), length(row.down), length(row.across)]),
      s.layerPlacementNote,
    ),
    table(
      "Repeat spec",
      [textColumn("Layer"), textColumn("Type"), textColumn("Name"), textColumn("Repeat"), textColumn("Seed"), textColumn("Record a machine can read")],
      s.repeatSpecs.map((row) => [text(row.layer), text(row.kind === "generator" ? "Generated pattern" : "Repeating picture"), text(row.name), text(row.repeat), text(row.seed), text(row.machine)]),
    ),
    table(
      "Pictures and their resolution",
      [textColumn("Layer"), textColumn("Picture"), textColumn("Pixels"), lengthColumn("Printed width"), valueColumn("Resolution"), textColumn("Result"), valueColumn("Accepted below the minimum by"), textColumn("What it means")],
      s.images.map((row) => [text(row.layer), text(row.picture), text(row.pixels), length(row.printedWidth), value(row.dpi), text(RESULT_WORDS[row.result]), value(row.acceptedBy), text(row.sentence)]),
      s.imagesNote,
    ),
  ];
}

function pictureTables(s: Artwork): ExportTable[] {
  const block = s.picture;
  if (block === null) return [];
  const field = (label: string, content: string | null): Datum[][] => (content === null ? [] : [[text(label), text(content)]]);
  return [
    table(
      "Read from a picture",
      [textColumn("Field"), textColumn("Value")],
      [
        ...field("What this is", block.closeReading),
        ...field("Summary", block.summary),
        ...field("The picture", block.pictureNote),
        ...field("How sure", block.confidence),
        ...field("Fitted to", block.fittedTo),
        ...field("Layers the acceptance does not cover", block.notAccepted.length === 0 ? null : block.notAccepted.join(", ")),
        ...block.items.map((item): Datum[] => [text(item.label), text(`${item.confidence}. ${item.note}`)]),
        ...block.emptyViews.map((sentence): Datum[] => [text("Left empty"), text(sentence)]),
        ...block.guessed.map((sentence): Datum[] => [text("Guessed"), text(sentence)]),
        ...block.notes.map((sentence): Datum[] => [text("Note"), text(sentence)]),
        ...block.limits.map((sentence): Datum[] => [text("Limit"), text(sentence)]),
      ],
    ),
    table("Who accepted the reading", [textColumn("Field"), valueColumn("Value")], [[text("Accepted by"), value(block.acceptedBy)]]),
  ];
}

function repeatTables(s: Artwork): ExportTable[] {
  const repeat = s.repeat;
  if (repeat === null) return [];
  return [
    table("Repeat sizes", [textColumn("Item"), lengthColumn("Size")], [...repeat.lengths.map((row) => [text(row.label), length(row.measure)]), [text("Closest gap between two dots, edge to edge"), length(repeat.gap)]], repeat.checks.join(" ")),
    table("Repeat settings", [textColumn("Item"), valueColumn("Setting")], repeat.settings.map((row) => [text(row.label), value(row.setting)])),
  ];
}

function printTables(s: Artwork): ExportTable[] {
  return [
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
}

export function artworkAndColourSection(pack: TechPack): ExportSection {
  const s = pack.artworkAndColour;
  return {
    id: "artwork-and-colour",
    title: s.title,
    paragraphs: sentences(s.note, s.description),
    tables: [...colourTables(s), ...layerTables(s), ...pictureTables(s), ...repeatTables(s), ...printTables(s)],
  };
}
