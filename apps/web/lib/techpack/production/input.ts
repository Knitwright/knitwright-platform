import type { ArtworkStack } from "@/lib/artwork-stack";
import type { ImportReport } from "@/lib/design-import/report";
import type {
  FabricProfile,
  GradedPattern,
  PatternMeasurement,
  PrintProfile,
  PrintRuleSet,
  PrintZone,
  SizeLabelMap,
} from "@/lib/production/contract";

/**
 * What the production services give the tech pack (plans/production-outputs.md, W5). In phase A
 * these records come from the W0 fixtures. In phase B the pattern library, the fabric library,
 * the print builder and the release services fill them in. Every field is optional on purpose:
 * a design with none of them still gets a factory file, and its readiness list says what is missing.
 */

/** A named person and a date, as the person or the services recorded them. The date is printed as it is. */
export interface NamedRecord {
  readonly name: string;
  readonly date: string;
  readonly dateIso: string;
}

export interface PatternReview extends NamedRecord {
  readonly blockVersion: number;
  readonly note: string | null;
}

/** Two pieces that are sewn together and how far their seam lengths differ at one size. */
export interface SeamAgreement {
  readonly size: string;
  readonly seamId: string;
  readonly label: string;
  /** The longer edge minus the shorter, in millimetres. */
  readonly differenceMm: number;
  /** The ease the pattern states for this seam, or null when it states none. */
  readonly statedEaseMm: number | null;
}

export interface ColourStandard {
  readonly id: string;
  /** What the colour is for, in words, such as "base" or "dot row A". */
  readonly role: string;
  readonly name: string;
  /** What a person typed as the factory's code, or null. Knitwright ships no Pantone data. */
  readonly factoryCode: string | null;
  /** The colour drawn on screen, or null. It is never a colour code. */
  readonly screenColour: string | null;
  /** The person who accepted that this colour is used though the print house avoids it, or null. */
  readonly avoidAcceptedBy: string | null;
  /** Every code a person typed for the colour, each with its system in words. Shown as typed; Knitwright ships no Pantone data. */
  readonly typedCodes?: readonly TypedCode[];
}

/** A colour code as a person typed it, with the system they named, such as "Pantone TCX". */
export interface TypedCode {
  readonly system: string;
  readonly value: string;
}

export interface RepeatSpec {
  readonly style: "dots";
  readonly diameterMm: number;
  readonly pitchMm: number;
  readonly rowStepMm: number;
  readonly halfDrop: boolean;
  readonly rowColours: Readonly<Record<"A" | "B", string>>;
  readonly clearSpaceMm: number;
}

/** What the print builder reports for one file. The files themselves are never in the tech pack. */
export interface PrintFileReport {
  readonly pieceId: string;
  readonly size: string;
  readonly playerNumber?: string;
  readonly bleedMm: number;
  readonly scaleX: number;
  readonly scaleY: number;
  /** Marks found outside their zone or inside its clear space, named in words. */
  readonly markProblems: readonly string[];
  /** True when text and lines are at or above the profile's minimums. */
  readonly minimumsMet: boolean;
}

/** One uploaded picture as the artwork intake (W7b) records it. The pixels are not here. */
export interface PlacedAsset {
  readonly id: string;
  readonly label: string;
  readonly kind: "raster" | "vector";
  readonly widthPx: number;
  readonly heightPx: number;
  /** The resolution the file states, or null when it states none. */
  readonly dpiMeta: number | null;
}

/** Someone accepted, by name, that a placed picture is below the minimum resolution. */
export interface LowDpiAcceptance extends NamedRecord {
  readonly layerId: string;
}

/** The lowest resolution the print house accepts, and where that came from (open owner input P14). */
export interface MinDpiSetting {
  readonly value: number;
  readonly source: "print-house" | "knitwright-default";
}

/** A design read from a picture (W7d): the report, and the user's acceptance of it. Null acceptance means nobody has accepted it. */
export interface PictureRead {
  readonly report: ImportReport;
  /** The layers the user accepted, or null when the reading was not accepted. */
  readonly acceptedLayerIds: readonly string[] | null;
  readonly acceptedBy: NamedRecord | null;
}

export type SignOffRole = "pattern" | "print" | "production" | "club";

export interface SignOffRecord extends NamedRecord {
  readonly role: SignOffRole;
}

export interface StrikeOffRecord extends NamedRecord {
  /** The release the strike-off was made for. A strike-off counts only for that release. */
  readonly releaseId: string;
  /** The shrink the strike-off measured, as a sentence, or null. */
  readonly result: string | null;
}

export interface MarkerSetting {
  readonly efficiencyPct: number;
  readonly source: "factory" | "marker" | "knitwright-default";
}

/** A target a person gave for a point only a pattern measures, such as the sleeve cap height. */
export interface PatternOnlyTarget {
  readonly pointId: string;
  /** The pattern size it is for. */
  readonly size: string;
  readonly targetTenthsMm: number;
  readonly toleranceTenthsMm: number;
}

export interface ReleaseInfo {
  readonly id: string;
  readonly files: number;
  readonly createdOn: string;
}

export interface ProductionInput {
  /** The pattern, every ordered size, from one block version. */
  readonly pattern?: GradedPattern | null;
  readonly review?: PatternReview | null;
  readonly measured?: readonly PatternMeasurement[];
  readonly patternOnlyTargets?: readonly PatternOnlyTarget[];
  readonly seamAgreements?: readonly SeamAgreement[];
  /** How much the block reduced the pattern for stretch, per axis, in percent. */
  readonly blockReduction?: { readonly lengthPct: number; readonly widthPct: number } | null;
  /** Which pattern size each size label is cut from. Without it a label is read as the pattern size of the same name. */
  readonly sizeMap?: readonly SizeLabelMap[];
  readonly fabric?: FabricProfile | null;
  readonly marker?: MarkerSetting | null;
  readonly printProfile?: PrintProfile | null;
  readonly printRules?: PrintRuleSet | null;
  readonly zones?: readonly PrintZone[];
  readonly printFiles?: readonly PrintFileReport[];
  readonly colours?: readonly ColourStandard[];
  readonly repeat?: RepeatSpec | null;
  /** The artwork stack of the design (W7a). When absent the design's own stack is used, and only a design with none falls back to the older fields. */
  readonly stack?: ArtworkStack | null;
  /** The colourway the colour list and the placements are shown for. The stack's first when missing. */
  readonly colourwayId?: string;
  /** The uploaded pictures the stack places, with their pixel sizes. */
  readonly assets?: readonly PlacedAsset[];
  readonly minDpi?: MinDpiSetting | null;
  readonly lowDpiAcceptances?: readonly LowDpiAcceptance[];
  readonly picture?: PictureRead | null;
  /** The technique used for the artwork, such as "sublimation". */
  readonly technique?: string | null;
  readonly signOffs?: readonly SignOffRecord[];
  readonly strikeOff?: StrikeOffRecord | null;
  /** Problems found in the team order, or null when the design has no roster. */
  readonly rosterProblems?: readonly string[] | null;
  /** The players of the team order, each with the size label they wear. */
  readonly rosterPlayers?: readonly { readonly number: string; readonly size: string }[];
  readonly release?: ReleaseInfo | null;
}
