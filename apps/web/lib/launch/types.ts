import type { BoardKind, BoardStatus, OutputRole } from "./boards";

/** Whole pixels from the canvas origin. The canvas is in pixels; the inspector converts for display. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** One colour of the project palette, shown in the right inspector with nothing selected. */
export interface ProjectColour {
  readonly hex: string;
  readonly name: string;
}

/** A connector: one board's right-edge dot into another board's numbered input. */
export interface BoardLink {
  readonly id: string;
  readonly fromBoardId: string;
  readonly toBoardId: string;
  /** 1 for "image 1", 2 for "image 2", as the AI boards' prompts name them (spec F-L4). */
  readonly inputIndex: number;
}

export interface BoardView {
  readonly id: string;
  readonly kind: BoardKind;
  readonly name: string;
  readonly at: Point;
  readonly size: Size;
  /** The board's own prompt, model, aspect and style, so Regenerate reruns it unchanged (spec F-L4). */
  readonly settings: Readonly<Record<string, unknown>>;
  /** The design version this board's input was taken at, or null for a board no design feeds. */
  readonly inputVersion: number | null;
  /** The file the last run produced, or null. */
  readonly outputFileId: string | null;
  readonly outputRole: OutputRole;
  readonly status: BoardStatus;
  /** Credits the last run spent, or null for a board that has never run or never cost anything. */
  readonly lastCostCredits: number | null;
  readonly ruleId: string;
}

export interface LaunchProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly units: "px" | "in" | "mm";
  readonly boards: number;
  readonly updatedAt: string;
}

export interface LaunchProjectView {
  readonly id: string;
  readonly brandId: string;
  readonly name: string;
  /** The project's unit, from the Settings item of the main menu: Pixels, Inches or Millimetres. */
  readonly units: "px" | "in" | "mm";
  readonly colours: readonly ProjectColour[];
  /** The design the project is launching, or null while none is chosen. */
  readonly designProjectId: string | null;
  readonly boards: readonly BoardView[];
  readonly edges: readonly BoardLink[];
  readonly updatedAt: string;
}

/** One saved version of a project, for the main menu's Version history. */
export interface LaunchVersion {
  readonly id: string;
  readonly version: number;
  readonly boards: number;
  readonly createdAt: string;
}

/** A labelled artboard size a platform admin keeps as a row, never a literal in code. */
export interface ArtboardPreset {
  readonly key: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly unit: "px" | "in" | "mm";
  readonly dpi: number;
  readonly ruleId: string;
  /** Says where the size came from. Seeded sizes say they are not reviewed by anyone.  */
  readonly note: string;
}
