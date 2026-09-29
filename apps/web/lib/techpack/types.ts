import type { ComponentKind, LabellingField, PointGroup, Provenance } from "@/lib/garment";
import type { FlatModel, View } from "@/lib/flat/model";
import type { Cell, ClassCell, LengthValue, TbcCell } from "./cell";

export type { Cell, ClassCell, LengthCell, LengthValue, SetCell, TbcCell } from "./cell";

/**
 * The tech pack document: plain data that the screen, the PDF, the Excel file and the SVG
 * files are all made from. It holds no function, no date of its own and no reference to
 * anything outside itself. Every value a factory reads is a `Cell`, which carries its source.
 */

export const SECTION_IDS = [
  "cover",
  "flats",
  "measurements",
  "how-to-measure",
  "components",
  "construction",
  "colourways",
  "artwork",
  "labelling",
  "suggested",
  "sign-off",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_TITLES: Readonly<Record<SectionId, string>> = {
  cover: "Cover",
  flats: "Flats with callouts",
  measurements: "Measurement table",
  "how-to-measure": "How to measure",
  components: "Component list",
  construction: "Construction",
  colourways: "Colourways",
  artwork: "Artwork placement",
  labelling: "Labels and packing",
  suggested: "Suggested values",
  "sign-off": "Sign-off",
};

/** What every section starts with. */
export interface SectionHead {
  readonly id: SectionId;
  readonly title: string;
  /** One plain sentence saying what is missing or what to know, or null when nothing is. */
  readonly note: string | null;
}

export interface Revision {
  readonly version: number;
  readonly date: string;
  readonly note: string;
  readonly by: string;
}

export interface CoverSection extends SectionHead {
  readonly styleNumber: Cell;
  readonly season: Cell;
  readonly brand: Cell;
  readonly designName: Cell;
  readonly garmentType: Cell;
  readonly wearer: Cell;
  readonly version: number;
  readonly date: string;
  readonly baseSize: Cell;
  readonly sizeRun: Cell;
  /** Each option of the design and the choice made, with who chose it. */
  readonly options: readonly { readonly id: string; readonly label: string; readonly choice: Cell }[];
  /** Newest first, at most the named limit. */
  readonly revisions: readonly Revision[];
  /** Says older revisions are not shown, or null when all are. */
  readonly olderRevisionsNote: string | null;
}

export interface FlatViewSection {
  readonly view: View;
  readonly label: string;
  /** The drawing, or null when the garment type has none. Callout values are in it only when it is to scale. */
  readonly model: FlatModel | null;
  readonly toScale: boolean;
  readonly notice: string | null;
  readonly description: string;
}

export interface CalloutKey {
  readonly code: string;
  readonly pointId: string;
  readonly label: string;
}

export interface FlatsSection extends SectionHead {
  readonly views: readonly FlatViewSection[];
  /** The codes on the drawing and in the table. Empty when the drawing is not to scale. */
  readonly callouts: readonly CalloutKey[];
}

export interface SizeColumn {
  /** The size label, or null when the design has no sizes yet. */
  readonly size: string | null;
  readonly label: string;
  readonly isBase: boolean;
}

export interface MeasureRow {
  readonly pointId: string;
  /** A short code that ties this row to the drawing. */
  readonly code: string;
  readonly label: string;
  readonly tolerance: LengthValue;
  /** One value for each column, in column order. */
  readonly values: readonly LengthValue[];
  /** Plain sentences about the row, such as why a value is missing. */
  readonly notes: readonly string[];
}

export interface MeasureGroup {
  readonly group: PointGroup;
  readonly label: string;
  readonly rows: readonly MeasureRow[];
}

export interface MeasurementsSection extends SectionHead {
  readonly columns: readonly SizeColumn[];
  readonly groups: readonly MeasureGroup[];
  /** Where the sizes came from, in words, or null when there are none. */
  readonly sizesFrom: "design" | "chart" | null;
}

export interface HowToMeasureRow {
  readonly pointId: string;
  readonly code: string;
  readonly label: string;
  readonly howToMeasure: string;
}

export interface HowToMeasureSection extends SectionHead {
  readonly rows: readonly HowToMeasureRow[];
}

export interface PanelName {
  readonly id: string;
  readonly label: string;
}

/** One fabric, and every panel that uses it. */
export interface FabricLine {
  readonly fabricId: string;
  readonly panels: readonly PanelName[];
  readonly name: Cell;
  readonly composition: Cell;
  readonly construction: Cell;
  readonly weight: Cell;
  readonly finish: Cell;
  readonly stretch: Cell;
  readonly consumption: Cell;
}

/** Thread, a label, rib or a trim that the design implies, or that the user described. */
export interface ComponentLine {
  readonly slotId: string;
  readonly label: string;
  readonly kind: ComponentKind;
  readonly kindLabel: string;
  readonly help: string;
  readonly panels: readonly PanelName[];
  readonly name: Cell;
  readonly details: Cell;
  readonly quantity: Cell;
}

export interface ComponentsSection extends SectionHead {
  readonly fabrics: readonly FabricLine[];
  readonly others: readonly ComponentLine[];
}

export interface SeamLine {
  readonly seamId: string;
  readonly label: string;
  readonly panels: readonly PanelName[];
  readonly seamClass: ClassCell;
  readonly stitchClass: ClassCell;
  readonly stitchDensity: Cell;
}

export interface ConstructionSection extends SectionHead {
  readonly seams: readonly SeamLine[];
}

export interface ColourwayRow {
  readonly panelId: string;
  readonly label: string;
  /** The colour name or code a factory uses. */
  readonly code: Cell;
  /** The colour drawn on screen. It is not a colour code. */
  readonly screenColour: Cell;
}

export interface ColourwayBlock {
  readonly id: string;
  readonly name: string;
  readonly rows: readonly ColourwayRow[];
}

export interface ColourwaysSection extends SectionHead {
  readonly colourways: readonly ColourwayBlock[];
}

export type ArtworkContent =
  | { readonly kind: "file"; readonly reference: Cell }
  | { readonly kind: "text"; readonly text: Cell };

export interface ArtworkItem {
  readonly id: string;
  readonly name: Cell;
  readonly panel: Cell;
  readonly anchor: Cell;
  readonly across: LengthValue;
  readonly down: LengthValue;
  readonly width: LengthValue;
  readonly height: LengthValue;
  readonly rotation: Cell;
  readonly technique: Cell;
  readonly content: ArtworkContent;
}

export interface ArtworkSection extends SectionHead {
  readonly items: readonly ArtworkItem[];
}

export interface LabellingRow {
  readonly field: LabellingField;
  readonly label: string;
  readonly value: Cell;
}

export interface LabellingSection extends SectionHead {
  readonly rows: readonly LabellingRow[];
}

/** A value in the document that is a suggestion, so the brand can confirm it. */
export interface SuggestedItem {
  readonly sectionId: SectionId;
  readonly sectionTitle: string;
  readonly label: string;
  readonly provenance: Provenance;
}

export interface SuggestedSection extends SectionHead {
  readonly items: readonly SuggestedItem[];
}

/**
 * A place for a named person and a date. In this step it is always empty, and its type says
 * so: the name and the date can only be "to be confirmed".
 */
export interface SignOffSection extends SectionHead {
  readonly statement: string;
  readonly name: TbcCell;
  readonly date: TbcCell;
}

export interface TechPack {
  readonly title: string;
  /** The date this copy was printed, as passed in. */
  readonly printedOn: string;
  /** Every section in reading order, for a contents list. */
  readonly sections: readonly SectionHead[];
  readonly cover: CoverSection;
  readonly flats: FlatsSection;
  readonly measurements: MeasurementsSection;
  readonly howToMeasure: HowToMeasureSection;
  readonly components: ComponentsSection;
  readonly construction: ConstructionSection;
  readonly colourways: ColourwaysSection;
  readonly artwork: ArtworkSection;
  readonly labelling: LabellingSection;
  readonly suggested: SuggestedSection;
  readonly signOff: SignOffSection;
}
