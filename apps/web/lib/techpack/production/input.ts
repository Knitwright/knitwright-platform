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
