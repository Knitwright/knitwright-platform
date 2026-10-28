import { KIT_PATTERN_STYLES, type GarmentSpec, type KitPattern, type KitPatternStyle, type NamesAndNumbers } from "@/lib/garment";
import { designWith, madeUpValues } from "@/lib/flat/fixtures/designs";
import type { ArtworkStack } from "../schema";

const NAVY = "#1b2a49";
const GOLD = "#d4af37";
const WHITE = "#ffffff";

export const kitPatternOf = (style: KitPatternStyle, patch: Partial<KitPattern> = {}): KitPattern => ({
  style,
  colours: [
    { colour: "Gold", swatch: GOLD },
    { colour: "", swatch: WHITE },
  ],
  provenance: "user-edited",
  ...patch,
});

/** The benchmark polka-dot jersey's numbers: 30 mm dots, 70 mm apart, rows 35 mm apart, half drop, 10 mm clear. */
export const BENCHMARK_DOTS: KitPattern = kitPatternOf("dots", { size: 300, dots: { pitch: 700, rowStep: 350, halfDrop: true, clearSpace: 100 } });

export const MARKS: NamesAndNumbers = {
  places: [{ place: "back-name", height: 600 }, { place: "back-number" }, { place: "front-number" }],
  style: "block",
  colour: "White",
  swatch: WHITE,
  technique: "sublimation",
  sampleName: "RIVERA",
  sampleNumber: "9",
  provenance: "user-edited",
};

/** A team jersey in navy, with whatever is given. */
export function jersey(extra: Partial<GarmentSpec> = {}, choices: Readonly<Record<string, string>> = {}): GarmentSpec {
  const base = designWith("team-jersey", choices, madeUpValues(choices));
  const colours = ["body-front", "body-back", "sleeve-left", "sleeve-right"].map((panelId) => ({
    panelId,
    colour: "Navy",
    swatch: NAVY,
    provenance: "user-edited" as const,
  }));
  const second = { id: "away", name: "Away", colours: colours.map((entry) => ({ ...entry, colour: "", swatch: "#aa0000" })) };
  return { ...base, colourways: [{ ...base.colourways[0], colours }, second], ...extra };
}

const FILE_ID = "6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";

export const LOGO_AND_TEXT: GarmentSpec["artwork"] = [
  {
    id: "crest",
    name: "Club crest",
    source: { kind: "file", fileId: FILE_ID },
    panelId: "body-front",
    anchor: "left-chest",
    offsetX: 20,
    offsetY: -35,
    width: 900,
    height: 900,
    rotationDegrees: 0,
    technique: "sublimation",
    provenance: "user-edited",
  },
  {
    id: "sponsor",
    name: "Sponsor line",
    source: { kind: "text", text: "ACME PLUMBING" },
    panelId: "body-front",
    anchor: "centre-chest",
    offsetX: 0,
    offsetY: 0,
    width: 2400,
    height: 300,
    rotationDegrees: 15,
    technique: "transfer",
    provenance: "ai-suggested",
  },
  {
    id: "sleeve-badge",
    name: "Sleeve badge",
    source: { kind: "file", fileId: FILE_ID },
    panelId: "sleeve-left",
    anchor: "sleeve-centre",
    offsetX: 0,
    offsetY: 0,
    width: 700,
    height: 700,
    rotationDegrees: 0,
    technique: "sublimation",
    provenance: "user-edited",
  },
];

/** Every design the stack must carry unchanged: each style, with and without a size, and designs with none. */
export function allDesigns(): readonly { readonly name: string; readonly spec: GarmentSpec }[] {
  const styles = KIT_PATTERN_STYLES.flatMap((style) => [
    { name: style, spec: jersey({ kitPattern: kitPatternOf(style) }) },
    { name: `${style} sized, one colour`, spec: jersey({ kitPattern: kitPatternOf(style, { size: 650, colours: [{ colour: "Gold", swatch: GOLD }], technique: "sublimation" }) }) },
  ]);
  return [
    { name: "plain", spec: jersey() },
    ...styles,
    { name: "with artwork and marks", spec: jersey({ kitPattern: kitPatternOf("hoops"), artwork: LOGO_AND_TEXT, namesAndNumbers: MARKS }) },
    { name: "dots with spacing, artwork and marks", spec: jersey({ kitPattern: BENCHMARK_DOTS, artwork: LOGO_AND_TEXT, namesAndNumbers: MARKS }) },
    { name: "dots lined up", spec: jersey({ kitPattern: kitPatternOf("dots", { size: 300, dots: { pitch: 700, halfDrop: false } }) }) },
    { name: "long sleeve", spec: jersey({ kitPattern: kitPatternOf("sash") }, { "sleeve-length": "long" }) },
  ];
}

export const withStack = (spec: GarmentSpec, stack: ArtworkStack): GarmentSpec => ({ ...spec, artworkStack: stack });
