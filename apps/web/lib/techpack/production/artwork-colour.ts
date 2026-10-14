import { formatCm } from "@/lib/garment";
import { DEFAULT_LABEL, type GradedPattern, type PatternPiece, type PrintProfile, type PrintRuleSet, type PrintZone } from "@/lib/production/contract";
import { TBC, textCell, type Cell, type LengthCell, type LengthValue, type NumberValue } from "../cell";
import { listOf } from "../text";
import { SECTION_TITLES, type ColourwaysSection } from "../types";
import type { ColourStandard, PrintFileReport, ProductionInput } from "./input";
import { placementOf } from "./placement";
import { buildRepeat } from "./repeat";
import type {
  ArtworkAndColourSection,
  ColourStandardRow,
  PlacementRow,
  PrintParameterRow,
  PrintRuleRow,
  ZoneRow,
} from "./types";

export const ZONE_LABELS: Readonly<Record<PrintZone["purpose"], string>> = {
  crest: "Crest",
  sponsor: "Sponsor",
  "front-number": "Front number",
  "back-name": "Back name",
  "back-number": "Back number",
  "sleeve-badge": "Sleeve badge",
  "sleeve-band": "Sleeve band",
};

export const NO_LEAGUE_RULES = "No league rules set: check with the competition.";
const NO_AVOID_COLOURS = "The print house has listed no colours to avoid. The list is empty.";
const FACTORY_CODE_NOTE =
  "A factory code is what a person typed. Knitwright ships no Pantone data. The screen colour only sets how a drawing looks.";

const lengthMm = (mm: number, provenance: LengthCell["provenance"]): LengthCell => {
  return { status: "set", value: formatCm(mm * 10), tenthsMm: Math.round(mm * 10), provenance };
};

/** The colours of the colourways, one standard for each distinct code and screen colour. Used when nobody gave the colours a role. */
export function coloursFromColourways(colourways: ColourwaysSection): ColourStandard[] {
  const found = new Map<string, { code: string | null; screen: string | null; roles: string[] }>();
  for (const block of colourways.colourways) {
    for (const row of block.rows) {
      const code = row.code.status === "set" ? row.code.value : null;
      const screen = row.screenColour.status === "set" ? row.screenColour.value : null;
      if (code === null && screen === null) continue;
      const key = `${code ?? ""}|${screen ?? ""}`;
      const entry = found.get(key) ?? { code, screen, roles: [] };
      found.set(key, { ...entry, roles: entry.roles.includes(row.label) ? entry.roles : [...entry.roles, row.label] });
    }
  }
  return [...found.values()].map((entry, index) => ({
    id: `C${index + 1}`,
    role: listOf(entry.roles),
    name: entry.code ?? "Colour not named",
    factoryCode: entry.code,
    screenColour: entry.screen,
    avoidAcceptedBy: null,
  }));
}

const colourRow = (colour: ColourStandard): ColourStandardRow => ({
  id: colour.id,
  role: colour.role,
  name: textCell(colour.name, "user-edited"),
  factoryCode: colour.factoryCode === null ? TBC : textCell(colour.factoryCode, "user-edited"),
  screenColour: colour.screenColour === null ? TBC : textCell(colour.screenColour, "user-edited"),
});

function zoneRows(zones: readonly PrintZone[], pieces: ReadonlyMap<string, PatternPiece>): ZoneRow[] {
  return zones.map((zone) => ({
    id: zone.id,
    purpose: ZONE_LABELS[zone.purpose],
    pieceName: pieces.get(zone.pieceId)?.name ?? zone.pieceId,
    clearSpace: lengthMm(zone.clearSpaceMm, "user-edited"),
    sizes: Object.keys(zone.polygonBySize).join(", "),
  }));
}

function placementRows(zones: readonly PrintZone[], pattern: GradedPattern | null | undefined): PlacementRow[] {
  return zones.flatMap((zone) =>
    Object.entries(zone.polygonBySize).map(([size, polygon]) => {
      const piece = pattern?.piecesBySize[size]?.find((candidate) => candidate.id === zone.pieceId);
      return { size, zone: ZONE_LABELS[zone.purpose], pieceName: piece?.name ?? zone.pieceId, ...placementOf(piece, polygon) };
    }),
  );
}

const mmCell = (mm: number | null | undefined): LengthValue => (mm === null || mm === undefined ? TBC : lengthMm(mm, "user-edited"));

function ruleRows(rules: PrintRuleSet | null | undefined, profile: PrintProfile | null | undefined): PrintRuleRow[] {
  const heights = rules?.numberRules;
  const profileText = profile
    ? `${profile.dpi} dpi, ${formatCm(Math.round(profile.bleedMm * 10))} cm bleed. ${profile.source === "print-house" ? "From your print house." : `${DEFAULT_LABEL}.`}`
    : null;
  const text = (value: string, provenance: "user-edited" | "derived" = "user-edited"): Cell => ({ status: "set", value, provenance });
  const length = (mm: number | null | undefined): Cell => {
    const cell = mmCell(mm);
    return cell.status === "set" ? text(`${cell.value} cm`) : TBC;
  };
  return [
    { label: "Print settings", text: profileText === null ? TBC : text(profileText, profile?.source === "print-house" ? "user-edited" : "derived") },
    { label: "Smallest text height", text: length(rules?.minTextHeightMm) },
    { label: "Thinnest line", text: length(rules?.minLineMm) },
    { label: "Colours to avoid", text: text(rules && rules.coloursToAvoid.length > 0 ? rules.coloursToAvoid.join(", ") : NO_AVOID_COLOURS, "derived") },
    {
      label: "League number rules",
      text: heights
        ? text(`Numbers ${formatCm(Math.round(heights.minHeightMm * 10))} to ${formatCm(Math.round(heights.maxHeightMm * 10))} cm high. ${heights.source}`)
        : text(NO_LEAGUE_RULES, "derived"),
    },
  ];
}

const scaleCell = (scale: number): NumberValue => ({
  status: "set",
  value: scale.toFixed(4),
  provenance: "derived",
  number: Math.round(scale * 10_000) / 10_000,
  unit: "times",
});

function parameterRows(files: readonly PrintFileReport[], pieces: ReadonlyMap<string, PatternPiece>): PrintParameterRow[] {
  return files
    .filter((file) => file.playerNumber === undefined)
    .map((file) => ({
      pieceName: pieces.get(file.pieceId)?.name ?? file.pieceId,
      size: file.size,
      player: "Whole team",
      bleed: lengthMm(file.bleedMm, "derived"),
      scaleAcross: scaleCell(file.scaleX),
      scaleDown: scaleCell(file.scaleY),
    }));
}

function parametersNote(files: readonly PrintFileReport[], profile: PrintProfile | null | undefined): string {
  if (files.length === 0) return "No print files have been made yet, so there are no print settings to list.";
  const players = new Set(files.flatMap((file) => (file.playerNumber === undefined ? [] : [file.playerNumber])));
  const own = players.size === 0 ? "" : ` ${players.size} players have their own files, made with the same bleed and scale.`;
  const unscaled = files.some((file) => file.scaleX === 1 && file.scaleY === 1) ? " Some files are not scaled for shrink." : "";
  const source = profile && profile.source === "knitwright-default" ? ` ${DEFAULT_LABEL}.` : "";
  return `${files.length} print ${files.length === 1 ? "file was" : "files were"} made at 1:1 with the bleed and scale listed.${own}${unscaled}${source}`;
}

/**
 * The colour standards, the dot repeat, the zones with their clear space, where each zone sits on
 * every size measured from the pattern, the print rules, and the settings the print files were made
 * with. Where a number is missing it is to be confirmed, never guessed.
 */
export function buildArtworkAndColour(input: ProductionInput, colourways: ColourwaysSection): ArtworkAndColourSection {
  const pieces = new Map<string, PatternPiece>(
    (input.pattern ? Object.values(input.pattern.piecesBySize).flat() : []).map((piece) => [piece.id, piece] as const),
  );
  const standards = input.colours ?? coloursFromColourways(colourways);
  const colours = standards.map(colourRow);
  const missingCodes = colours.filter((colour) => colour.factoryCode.status !== "set").length;
  const zones = input.zones ?? [];
  const files = input.printFiles ?? [];
  return {
    id: "artwork-and-colour",
    title: SECTION_TITLES["artwork-and-colour"],
    note: missingCodes > 0 ? `${missingCodes} ${missingCodes === 1 ? "colour has" : "colours have"} no factory code yet.` : null,
    colours,
    colourNote: FACTORY_CODE_NOTE,
    repeat: buildRepeat(input.repeat),
    zones: zoneRows(zones, pieces),
    placements: placementRows(zones, input.pattern),
    printRules: ruleRows(input.printRules, input.printProfile),
    printParameters: parameterRows(files, pieces),
    printParametersNote: parametersNote(files, input.printProfile),
  };
}
