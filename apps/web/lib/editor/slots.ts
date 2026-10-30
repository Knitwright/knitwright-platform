import type { BaseArticle } from "@/lib/catalogue";
import type { GarmentSpec, SpecAction } from "@/lib/garment";
import type { ArticleDraft, Finding as DraftFinding } from "@/lib/parametric";
import type { PatternPiece } from "@/lib/production/contract";

/**
 * THE SLOT CONTRACT (plan v5 wave 2, Y2, decision 0075).
 *
 * The editor shell owns the top bar, the left rail, the canvas, the bottom bar and the Design
 * Summary. The panels inside the rail and the canvas are built by other workstreams, and each is
 * given exactly `EditorSlotProps`: the design as read-only facts, and the commands it may call.
 * Nothing else crosses the seam. Y3, Y4, Y5 and Y8 code against this file; it does not change
 * without a loud note on the pull request, because four workstreams depend on it.
 *
 * A slot component is a default export taking `EditorSlotProps`, so the shell can load it with
 * `next/dynamic`. Until a slot is built the shell draws `slotPlaceholder(id)` in its place.
 */

/** Every panel the shell leaves for another workstream to fill. */
export const EDITOR_SLOTS = ["library", "specs", "view-2d", "tech-pack", "export", "names-numbers", "repeat-maker"] as const;
export type EditorSlotId = (typeof EDITOR_SLOTS)[number];

/** The article's option codes and parameter values in millimetres, as the person has them now. */
export type FormValues = Readonly<{
  options: Readonly<Record<string, string>>;
  parameters: Readonly<Record<string, number>>;
}>;

/** The three toolbars of the left rail (spec F-S4). */
export const RAIL_SEGMENTS = ["form", "library", "specs"] as const;
export type RailSegment = (typeof RAIL_SEGMENTS)[number];

/** The three views of one design version, toggled at the bottom centre (spec F-S4). */
export const CANVAS_VIEWS = ["2d", "3d", "tech-pack"] as const;
export type CanvasView = (typeof CANVAS_VIEWS)[number];

/** The sections of the right-hand Design Summary (spec F-S4). A row of one of them opens its editor in place. */
export const SUMMARY_SECTIONS = ["fabrics", "colours", "pattern-fills", "graphics", "names-numbers", "trims-labels", "stitches"] as const;
export type SummarySectionId = (typeof SUMMARY_SECTIONS)[number];

/**
 * The pieces the drafter (X3, `lib/parametric`) made for the shown size from the shown form, as the
 * production contract's pattern pieces, or why there are none. Never a guess: an article with no
 * script is "not drafted yet", and a value the article does not offer is "invalid" with its findings.
 */
export type EditorDraft =
  | Readonly<{ kind: "drafted"; draft: ArticleDraft; pieces: readonly PatternPiece[] }>
  | Readonly<{ kind: "not-drafted-yet"; reason: string; ruleId: string | null }>
  | Readonly<{ kind: "invalid"; findings: readonly DraftFinding[] }>;

/** What a slot panel may read. Everything here is already saved or already in flight; a slot never fetches. */
export interface EditorDesign {
  readonly projectId: string;
  readonly version: number;
  /** The design as it will be once the saves in flight land, so two changes in a row do not undo each other. */
  readonly spec: GarmentSpec;
  /** The base article the design sits on, with its approved options, ranges and construction, or null when the catalogue does not cover its type. */
  readonly article: BaseArticle | null;
  readonly form: FormValues;
  /** The size the canvas, the measurements and the tech pack are showing. */
  readonly size: string;
  readonly sizes: readonly string[];
  readonly colourwayId: string;
  readonly draft: EditorDraft | null;
  /** True while a save is in flight: a slot disables its own controls rather than queueing its own. */
  readonly busy: boolean;
}

/**
 * What a slot panel may ask the shell to do. Every call is a request: the shell checks it against the
 * article's approved options and ranges, saves it, shows the save status and re-drafts. A value the
 * article does not offer is refused here, so a slot cannot make an unmanufacturable design.
 */
export interface EditorCommands {
  /** Choose one of the article's approved options of a group, e.g. `("collar", "C02")`. */
  setOption(group: string, code: string): void;
  /** Set one structural parameter in millimetres. Refused outside the article's approved range. */
  setParameter(key: string, mm: number): void;
  setSize(size: string): void;
  setColourway(id: string): void;
  /** Show one view on its own, or `beside: true` to show it next to the one already shown. */
  showView(view: CanvasView, beside?: boolean): void;
  /** Open one of the left rail's three toolbars. */
  openRail(segment: RailSegment): void;
  /** Open a section of the Design Summary, whose editor then shows in the right-hand panel. */
  openSummary(section: SummarySectionId): void;
  /** Save a change to the design, under the name of the control it came from. The shell handles conflicts, undo and the status line. */
  save(key: string, action: SpecAction): void;
  /** Say that the 3D model no longer matches the design, so the chip reads "Not sim ready" until Simulate is pressed. */
  needsSimulation(): void;
}

/** Everything a slot component is given. A slot takes no other props. */
export interface EditorSlotProps {
  readonly design: EditorDesign;
  readonly commands: EditorCommands;
}

/** What the shell draws where a slot is not built yet: the panel's name, who is building it, and a test id. */
export interface SlotPlaceholder {
  readonly id: EditorSlotId;
  readonly title: string;
  readonly note: string;
  readonly testId: string;
}

const PLACEHOLDERS: Readonly<Record<EditorSlotId, Readonly<{ title: string; note: string }>>> = {
  library: {
    title: "Library",
    note: "Fabrics, colours, pattern fills and graphics. Built by workstream Y3; this panel is the slot it drops into.",
  },
  specs: {
    title: "Specs",
    note: "Select, measure point, measure line, measure edge and callout. Built by workstream Y4; this panel is the slot it drops into.",
  },
  "view-2d": {
    title: "2D pattern view",
    note: "Pattern pieces on a dotted grid with rulers, sew line, bleed, safe zone and a 100 mm scale bar. Built by workstream Y3.",
  },
  "tech-pack": {
    title: "Tech pack view",
    note: "The tech pack tabs, with the mm, cm and inch toggle and provenance chips. Built by workstream Y4.",
  },
  export: { title: "Export", note: "Tech pack, images, pattern, print files and the production package. Built by workstream Y5." },
  "names-numbers": { title: "Names & numbers", note: "Licensed fonts, colour roles and the zones the base article fixes. Built by workstream Y8." },
  "repeat-maker": { title: "Repeat maker", note: "Tile size, repeat style, layers and background, published to your library. Built by workstream Y8." },
};

/** The labelled placeholder for a slot. Says plainly that the panel is not built yet, and never pretends to be it. */
export function slotPlaceholder(id: EditorSlotId): SlotPlaceholder {
  const entry = PLACEHOLDERS[id];
  return { id, title: entry.title, note: entry.note, testId: `editor-slot-${id}` };
}
