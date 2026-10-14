import type { ReadinessItem } from "@/lib/production/contract";
import type { Cell, LengthValue, NumberValue } from "../cell";
import type { SectionHead } from "../types";
import type { ImageRow, LayerPlacementRow, LayerRow, PictureReadBlock, RepeatSpecRow } from "./types-art";

export type { ImageRow, ImageStatus, LayerPlacementRow, LayerRow, PictureReadBlock, RepeatSpecRow } from "./types-art";

/** The sections of tech pack v2 (plans/production-outputs.md, W5). Plain data like the rest of the document. */

export type ReadinessActor = ReadinessItem["whoActs"];

export interface ReadinessLine extends ReadinessItem {
  /** The actor in words, such as "Pattern technician". */
  readonly actorLabel: string;
}

export interface ReadinessGroup {
  readonly id: string;
  readonly title: string;
  readonly items: readonly ReadinessLine[];
}

export interface ReadinessSection extends SectionHead {
  /** True only when every item is met. */
  readonly ready: boolean;
  /** One sentence for the top: "Ready for the factory." or what is left. */
  readonly summary: string;
  readonly groups: readonly ReadinessGroup[];
  /** How many open items each actor has, for actors with at least one. */
  readonly open: readonly { readonly whoActs: ReadinessActor; readonly actorLabel: string; readonly count: number }[];
}

export interface CutRow {
  readonly size: string;
  readonly pieceId: string;
  readonly name: Cell;
  readonly quantity: NumberValue;
  /** "Cut 1 on the fold" or "Cut 2, a left and a right". */
  readonly cut: Cell;
  readonly grain: Cell;
  /** Whether the outline holds the seam allowance. */
  readonly outline: Cell;
  readonly notches: Cell;
  /** The area of the piece in square centimetres, measured on the pattern, counting every piece cut. */
  readonly area: NumberValue;
}

export interface SeamAllowanceRow {
  readonly size: string;
  readonly pieceName: string;
  readonly seamId: string;
  readonly allowance: LengthValue;
  /** Where the allowance came from, in words. */
  readonly sourceNote: string;
}

export interface FabricUseRow {
  readonly size: string;
  readonly area: NumberValue;
  readonly length: NumberValue;
  readonly note: string;
}

export interface PatternAndCuttingSection extends SectionHead {
  /** "Draft pattern, not reviewed." or who reviewed which version. */
  readonly reviewStatus: Cell;
  readonly blockName: string | null;
  readonly cutList: readonly CutRow[];
  readonly seamAllowances: readonly SeamAllowanceRow[];
  readonly fabricUse: readonly FabricUseRow[];
  /** Says how the fabric use was worked out, or why it was not. */
  readonly fabricUseNote: string;
}

export interface FabricRow {
  readonly id: string;
  readonly label: string;
  readonly measure: NumberValue;
  /** Where the number came from, in words. */
  readonly sourceNote: string;
}

export interface FabricSection extends SectionHead {
  readonly rows: readonly FabricRow[];
  /** How much larger artwork is printed, per axis. To be confirmed without a tested shrink. */
  readonly printScaleLength: NumberValue;
  readonly printScaleWidth: NumberValue;
  readonly printScaleNote: string;
  readonly reductionNote: string;
}

export interface ColourStandardRow {
  readonly id: string;
  readonly role: string;
  readonly name: Cell;
  readonly factoryCode: Cell;
  /** The colour drawn on screen. It is not a colour code. */
  readonly screenColour: Cell;
  /** Other codes a person typed, such as a Pantone code, each with the system they named. "None typed" when there are none. */
  readonly otherCodes: string;
}

export interface RepeatBlock {
  /** The sizes of the repeat, in centimetres. */
  readonly lengths: readonly { readonly label: string; readonly measure: LengthValue }[];
  /** The other settings of the repeat, in words. */
  readonly settings: readonly { readonly label: string; readonly setting: Cell }[];
  /** Plain sentences from the check on the repeat: the closest gap between two dots, and any problem. */
  readonly checks: readonly string[];
  readonly gap: LengthValue;
  readonly ok: boolean;
}

export interface ZoneRow {
  readonly id: string;
  readonly purpose: string;
  readonly pieceName: string;
  readonly clearSpace: LengthValue;
  readonly sizes: string;
}

export interface PlacementRow {
  readonly size: string;
  readonly zone: string;
  readonly pieceName: string;
  /** From the high point of shoulder (or the top of the sleeve cap) down to the top of the zone. */
  readonly down: LengthValue;
  /** From the centre front (or the middle of the sleeve) across to the middle of the zone. */
  readonly across: LengthValue;
}

export interface PrintParameterRow {
  readonly pieceName: string;
  readonly size: string;
  readonly player: string;
  readonly bleed: LengthValue;
  readonly scaleAcross: NumberValue;
  readonly scaleDown: NumberValue;
}

export interface PrintRuleRow {
  readonly label: string;
  readonly text: Cell;
}

export interface ArtworkAndColourSection extends SectionHead {
  /** Where the page was built from: the artwork stack of the design, or the older fields of a design that has none. */
  readonly source: "stack" | "legacy";
  /** The whole design in plain English, from the artwork stack. Null for a design with no stack. */
  readonly description: string | null;
  readonly colours: readonly ColourStandardRow[];
  /** Says what a factory code and a screen colour are. */
  readonly colourNote: string;
  /** Every layer with its kind, zone or anchor, clear space, technique and source. */
  readonly layers: readonly LayerRow[];
  /** Where each placed layer sits on every size, measured on the pattern. */
  readonly layerPlacements: readonly LayerPlacementRow[];
  readonly layerPlacementNote: string;
  /** The repeat of every pattern and repeating picture, as words and as a record a machine can read. */
  readonly repeatSpecs: readonly RepeatSpecRow[];
  /** The dots' repeat sizes, when the design has dots. */
  readonly repeat: RepeatBlock | null;
  readonly images: readonly ImageRow[];
  readonly imagesNote: string;
  /** The report of a design read from a picture, or null. */
  readonly picture: PictureReadBlock | null;
  readonly zones: readonly ZoneRow[];
  readonly placements: readonly PlacementRow[];
  readonly printRules: readonly PrintRuleRow[];
  readonly printParameters: readonly PrintParameterRow[];
  readonly printParametersNote: string;
}

export type OperationStage = "print" | "press" | "cut" | "sew" | "decorate" | "inspect";

export interface OperationStep {
  readonly order: number;
  readonly stage: OperationStage;
  readonly stageLabel: string;
  readonly label: string;
  /** Says the step is only proposed by Knitwright. */
  readonly detail: Cell;
}

export interface OperationsSection extends SectionHead {
  readonly technique: Cell;
  readonly steps: readonly OperationStep[];
}

export interface SignOffLine {
  readonly role: string;
  readonly name: Cell;
  readonly date: Cell;
}

export interface StrikeOffLine {
  readonly acceptedBy: Cell;
  readonly date: Cell;
  readonly result: Cell;
}

export interface OnPatternCell {
  readonly size: string;
  readonly target: LengthValue;
  readonly measured: LengthValue;
  /** Measured minus target. To be confirmed when either is missing. */
  readonly difference: LengthValue;
  /** Not called `status`: that word marks a cell of the document. */
  readonly result: "inside" | "outside" | "no-target" | "no-tolerance" | "not-measured";
  /** A sentence when the measured value is outside the tolerance, else null. */
  readonly flag: string | null;
}

export interface OnPatternRow {
  readonly pointId: string;
  readonly code: string;
  readonly label: string;
  readonly tolerance: LengthValue;
  readonly cells: readonly OnPatternCell[];
}

export interface PatternOnlyRow {
  readonly pointId: string;
  readonly label: string;
  readonly method: string;
  readonly tolerance: LengthValue;
  readonly cells: readonly OnPatternCell[];
}

/** The measurement table set against the pattern: target, measured, difference, inside tolerance or not. */
export interface OnPatternTable {
  readonly rows: readonly OnPatternRow[];
  readonly patternOnly: readonly PatternOnlyRow[];
  readonly outside: number;
  readonly summary: string;
}
