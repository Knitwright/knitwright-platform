import { printScale, type FabricProfile, type ReadinessItem } from "@/lib/production/contract";
import { listOf } from "../text";
import type { ColourStandard, PrintFileReport, ProductionInput } from "./input";
import { patternSizeOf } from "./measured";

type Item = ReadinessItem;

const item = (id: string, whoActs: Item["whoActs"], met: boolean, whenMet: string, whenOpen: string): Item => ({
  id,
  whoActs,
  met,
  sentence: met ? whenMet : whenOpen,
});

const SCALE_EPSILON = 0.0005;

const pieceKeys = (input: ProductionInput, orderedSizes: readonly string[]): string[] => {
  const map = input.sizeMap ?? [];
  const sizes = [...new Set(orderedSizes.map((label) => patternSizeOf(label, map)))];
  return sizes.flatMap((size) => (input.pattern?.piecesBySize[size] ?? []).map((piece) => `${piece.id}|${size}`));
};

function filesItem(input: ProductionInput, orderedSizes: readonly string[], players: ProductionInput["rosterPlayers"]): Item {
  const files = input.printFiles ?? [];
  const wanted = pieceKeys(input, orderedSizes);
  const haveTeam = new Set(files.filter((file) => file.playerNumber === undefined).map((file) => `${file.pieceId}|${file.size}`));
  const lacking = wanted.filter((key) => !haveTeam.has(key));
  const playersLacking = (players ?? []).filter((player) => !files.some((file) => file.playerNumber === player.number));
  const met = wanted.length > 0 && lacking.length === 0 && playersLacking.length === 0;
  const open =
    wanted.length === 0
      ? "Print files need a pattern first."
      : lacking.length > 0
        ? `Print files are missing for ${lacking.length} ${lacking.length === 1 ? "piece and size" : "pieces and sizes"}.`
        : `Print files are missing for ${playersLacking.length} ${playersLacking.length === 1 ? "player" : "players"}.`;
  return item("print-files", "technician", met, "There is a print file for every piece, size and player.", open);
}

const bleedItem = (files: readonly PrintFileReport[], profile: ProductionInput["printProfile"]): Item =>
  item(
    "print-bleed",
    "technician",
    files.length > 0 && profile != null && files.every((file) => file.bleedMm >= profile.bleedMm),
    "Every print file has at least the bleed of the print settings.",
    profile == null ? "Print files need print settings to take their bleed from." : "Make the print files again with at least the bleed of the print settings.",
  );

function scaleItem(files: readonly PrintFileReport[], fabric: FabricProfile | null | undefined): Item {
  const scale = fabric ? printScale(fabric) : null;
  const tested = scale !== null && !scale.notScaled && fabric?.shrinkLengthPct.source === "fabric-test" && fabric.shrinkWidthPct.source === "fabric-test";
  const matches = tested && files.length > 0 && files.every((file) => Math.abs(file.scaleX - scale.width) <= SCALE_EPSILON && Math.abs(file.scaleY - scale.length) <= SCALE_EPSILON);
  return item(
    "print-scale",
    "technician",
    matches,
    "Every print file is scaled from the fabric test.",
    tested ? "Make the print files again, scaled from the fabric test." : "Print files are not scaled for shrink until the fabric has a shrink test.",
  );
}

function marksItem(files: readonly PrintFileReport[]): Item {
  const bad = files.filter((file) => file.markProblems.length > 0 || !file.minimumsMet);
  const sentence = listOf([...new Set(bad.flatMap((file) => (file.markProblems.length > 0 ? file.markProblems : ["text or lines smaller than the minimum"])))]);
  return item(
    "print-marks",
    "technician",
    files.length > 0 && bad.length === 0,
    "Every mark is inside its zone and clear of the clear space, and text and lines meet the minimums.",
    files.length === 0 ? "Marks cannot be placed until print files are made." : `Move or resize marks: ${sentence}.`,
  );
}

const hex = (value: string | null): string | null => (value !== null && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null);

function colourItems(colours: readonly ColourStandard[], avoid: readonly string[]): Item[] {
  const noCode = colours.filter((colour) => colour.factoryCode === null || colour.factoryCode.trim() === "");
  const clash = colours.filter((colour) => {
    const screen = hex(colour.screenColour);
    return screen !== null && avoid.includes(screen) && colour.avoidAcceptedBy === null;
  });
  return [
    item(
      "print-colour-codes",
      "owner",
      colours.length > 0 && noCode.length === 0,
      "Every colour has a factory code.",
      colours.length === 0 ? "Add the colours of the design and a factory code for each." : `Type the factory code of ${listOf(noCode.map((colour) => `${colour.id} (${colour.name})`))}.`,
    ),
    item(
      "print-avoid-colours",
      "owner",
      clash.length === 0,
      "No colour is on the print house's list to avoid, or a named person accepted it.",
      `Change ${listOf(clash.map((colour) => colour.id))} or name the person who accepts it: the print house lists it as a colour to avoid.`,
    ),
  ];
}

/** Item 4 of the definition: print. */
export function printItems(input: ProductionInput, orderedSizes: readonly string[], colours: readonly ColourStandard[]): Item[] {
  const files = input.printFiles ?? [];
  return [
    item(
      "print-profile",
      "print-house",
      input.printProfile?.source === "print-house",
      "The print settings are from your print house.",
      "The print house gives its bleed, dpi and colour profile. Until then the settings are Knitwright defaults.",
    ),
    filesItem(input, orderedSizes, input.rosterPlayers),
    bleedItem(files, input.printProfile),
    scaleItem(files, input.fabric),
    marksItem(files),
    ...colourItems(colours, input.printRules?.coloursToAvoid ?? []),
    item(
      "league-rules",
      "club",
      input.printRules?.numberRules != null,
      "League number rules are set.",
      "No league rules set: check with the competition.",
    ),
  ];
}
