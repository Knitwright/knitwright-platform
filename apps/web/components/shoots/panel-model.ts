import { garmentSource, type BoardView, type LaunchContext, type LaunchCostSource } from "@/lib/launch";
import { CROP_LABELS, sceneBySlug, type Crop, type MockupScene } from "@/lib/mockups";
import {
  ALL_SHOOT_POSES,
  CHARGING_OFF_NOTE,
  IMAGE_COUNTS,
  MAX_EXTRA_PRODUCTS,
  MODAL_ACTIONS,
  MODAL_ACTION_LABELS,
  NO_ARTWORK_NOTE,
  PRESETS_NOTE,
  SHOOT_ASPECTS,
  SHOOT_ASPECT_LABELS,
  SHOOT_STYLES,
  SHOOT_STYLE_LABELS,
  conceptBySlug,
  cropOf,
  estimateFor,
  isPaidAction,
  licenceLabel,
  modalGaps,
  perImageLabel,
  posesOf,
  presetUsable,
  runVerdict,
  settingsOfConcept,
  shootCost,
  showsPerson,
  styleChoices,
  writeBoardSettings,
  type ModalAction,
  type ModelPreset,
  type ShootAspect,
  type ShootBoardSettings,
  type ShootConcept,
  type ShootCost,
  type ShootGap,
  type ShootPose,
  type ShootStyle,
  type RunVerdict,
} from "@/lib/shoots";
import * as copy from "@/lib/shoots/copy";

/**
 * THE AI IMAGE BOARD PANEL AS A VALUE (panel id `board-ai-image`, L1's contract).
 *
 * The component draws this and asks the shell for things; it decides nothing. So everything that
 * could be wrong -- an empty state that names no action, a cost on a button for a shoot that cannot
 * run, a model preset offered with no licence behind it, a Generate button on a board with no
 * garment -- is decided here, where a test reads it with no shell and no browser.
 *
 * The lock is read from the project the shell already gave us (`garmentSource`), never from a fetch:
 * a panel never fetches (decision 0091).
 */

export interface EmptyState {
  readonly title: string;
  readonly body: string;
  readonly action: string | null;
}

export interface PresetCard {
  readonly key: string;
  readonly label: string;
  readonly lead: string;
  readonly licence: string;
  readonly usable: boolean;
  readonly selected: boolean;
}

export interface Choice<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly selected: boolean;
}

export interface ResultState {
  readonly fileId: string | null;
  /** The words the spec puts on the picture: more again when a person is in it. */
  readonly label: string;
  readonly kept: boolean;
  /** What went wrong, with what it cost and what to do, or null. */
  readonly failure: string | null;
  readonly advice: string | null;
}

export interface BoardPanelView {
  readonly heading: string;
  readonly lead: string;
  readonly empty: EmptyState | null;
  readonly scene: MockupScene | null;
  readonly concept: ShootConcept | null;
  readonly styles: readonly Choice<ShootStyle>[];
  readonly aspects: readonly Choice<ShootAspect>[];
  readonly crop: Crop;
  readonly cropLabel: string;
  readonly counts: readonly Choice<string>[];
  readonly poses: readonly Choice<string>[];
  readonly cameras: readonly Choice<string>[];
  readonly presets: readonly PresetCard[];
  readonly modelLead: string;
  readonly cost: ShootCost;
  readonly perImage: string;
  readonly run: Readonly<{ label: string; disabled: boolean; reason: string | null }>;
  readonly regenerate: Readonly<{ label: string; hint: string; disabled: boolean }>;
  readonly result: ResultState | null;
  readonly edits: readonly Readonly<{ action: ModalAction; label: string; paid: boolean }>[];
  readonly extraProductsLeft: number;
  readonly notes: readonly string[];
  readonly gaps: readonly ShootGap[];
  readonly estimateMs: number;
  readonly busy: boolean;
}

export interface PanelInput {
  readonly context: LaunchContext;
  readonly settings: ShootBoardSettings;
  readonly presets: readonly ModelPreset[];
  /** `CREDITS_ENFORCED`. Off today, and the panel says so rather than pretending otherwise. */
  readonly creditsEnforced: boolean;
  readonly source: LaunchCostSource;
  readonly poses?: readonly ShootPose[];
}

const choice = <T extends string>(value: T, label: string, selected: boolean): Choice<T> => ({ value, label, selected });

const presetCards = (presets: readonly ModelPreset[], settings: ShootBoardSettings): readonly PresetCard[] =>
  presets.map((preset) => ({
    key: preset.key,
    label: preset.label,
    lead: `${preset.bodyType} · ${preset.ageBand} · ${preset.skinTone}`,
    licence: licenceLabel(preset),
    usable: presetUsable(preset),
    selected: settings.modelPresetKey === preset.key,
  }));

/** The one thing in the way, in the order a person would fix it. */
function emptyOf(board: BoardView | null, locked: boolean, scene: MockupScene | null): EmptyState | null {
  if (board === null) {
    return { title: copy.BOARD_PANEL_TITLE, body: copy.NO_SCENE_BODY, action: null };
  }
  if (!locked) return { title: copy.NO_DESIGN_TITLE, body: copy.NO_DESIGN_BODY, action: copy.NO_DESIGN_ACTION };
  if (scene === null) return { title: copy.NO_SCENE_TITLE, body: copy.NO_SCENE_BODY, action: copy.IDEAS_HEADING };
  return null;
}

/** What the board's own status and its last run say about the picture on it. */
function resultOf(board: BoardView | null, settings: ShootBoardSettings, scene: MockupScene | null): ResultState | null {
  if (board === null || board.status === "empty" || board.status === "queued" || board.status === "running") return null;
  const person = showsPerson(settings, scene);
  const kept = board.status === "ready";
  return {
    fileId: board.outputFileId,
    label: person ? "AI-generated model" : "AI-generated",
    kept,
    failure: kept ? null : copy.failureLine(`${copy.CHECKER_LEAD} ${copy.TRY_ANOTHER_POSE}`, board.lastCostCredits ?? 0),
    advice: kept ? copy.CHECKER_KEPT : copy.TRY_ANOTHER_POSE,
  };
}

function notesOf(input: PanelInput, cost: ShootCost): readonly string[] {
  const notes = [cost.note, PRESETS_NOTE, copy.AI_LABEL_NOTE, NO_ARTWORK_NOTE];
  if (!input.creditsEnforced) notes.push(CHARGING_OFF_NOTE);
  return notes;
}

/** Everything the board panel draws. Pure: the same context and settings always give the same view. */
export function boardPanelView(input: PanelInput): BoardPanelView {
  const board = input.context.selection?.board ?? null;
  const graph = { boards: input.context.project.boards, edges: input.context.project.edges };
  const locked = board === null ? false : garmentSource(graph, board.id).locked;
  const scene = input.settings.sceneSlug === null ? null : sceneBySlug(input.settings.sceneSlug);
  const poses = input.poses ?? ALL_SHOOT_POSES;
  const cost = shootCost(input.settings.count, input.source);
  const verdict: RunVerdict = runVerdict(input.settings, {
    garmentLocked: locked,
    scene,
    presets: input.presets,
    balance: input.context.credits,
    creditsEnforced: input.creditsEnforced,
    source: input.source,
  });
  const crop = cropOf(input.settings.aspect, scene?.crops ?? []);
  return {
    heading: copy.BOARD_PANEL_TITLE,
    lead: copy.BOARD_PANEL_LEAD,
    empty: emptyOf(board, locked, scene),
    scene,
    concept: input.settings.conceptSlug === null ? null : conceptBySlug(input.settings.conceptSlug),
    styles: SHOOT_STYLES.map((style) => choice(style, SHOOT_STYLE_LABELS[style], input.settings.style === style)),
    aspects: SHOOT_ASPECTS.map((aspect) => choice(aspect, SHOOT_ASPECT_LABELS[aspect], input.settings.aspect === aspect)),
    crop,
    cropLabel: CROP_LABELS[crop],
    counts: IMAGE_COUNTS.map((count) => choice(String(count), String(count), input.settings.count === count)),
    poses: posesOf("pose", poses).map((pose) => choice(pose.key, pose.label, input.settings.poseKey === pose.key)),
    cameras: posesOf("camera", poses).map((camera) => choice(camera.key, camera.label, input.settings.cameraKey === camera.key)),
    presets: presetCards(input.presets, input.settings),
    modelLead: copy.MODEL_LEAD,
    cost,
    perImage: perImageLabel(cost),
    run: {
      label: verdict.canRun ? verdict.cost.label : copy.GENERATE_HEADING,
      disabled: !verdict.canRun || input.context.busy,
      reason: verdict.canRun ? null : verdict.reason,
    },
    regenerate: { label: copy.REGENERATE, hint: copy.REGENERATE_HINT, disabled: !verdict.canRun || input.context.busy },
    result: resultOf(board, input.settings, scene),
    edits: MODAL_ACTIONS.map((action) => ({ action, label: MODAL_ACTION_LABELS[action], paid: isPaidAction(action) })),
    extraProductsLeft: MAX_EXTRA_PRODUCTS - input.settings.extraProductIds.length,
    notes: notesOf(input, cost),
    gaps: modalGaps(),
    estimateMs: estimateFor(input.settings.count),
    busy: input.context.busy,
  };
}

/** The style choices the rail's own custom shoot form offers, in the spec's order. */
export const styleOptions = styleChoices;

export type IdeaAction =
  | Readonly<{ kind: "set"; boardId: string; settings: Readonly<Record<string, unknown>>; said: string }>
  | Readonly<{ kind: "add"; at: Readonly<{ x: number; y: number }>; fromBoardId: string | null; said: string }>;

/**
 * What choosing a shoot idea asks the shell to do (F-L1: an idea starts an AI image board).
 *
 * With an AI image board already selected the idea's settings go onto it; otherwise a board is
 * added, fed by the Design board, beside it. `addBoard` does not hand back the new board's id, so
 * the words say what to do next rather than the panel half-setting something.
 *
 * It is here rather than in the component so a test can read the decision without a browser.
 */
export function ideaAction(context: LaunchContext, concept: ShootConcept): IdeaAction {
  const settings = writeBoardSettings(settingsOfConcept(concept));
  const selected = context.selection?.board ?? null;
  if (selected !== null && selected.kind === "ai_image") {
    return { kind: "set", boardId: selected.id, settings, said: `${concept.title} is set on this board. Press Generate when you are ready.` };
  }
  const design = context.project.boards.find((one) => one.kind === "design") ?? null;
  return {
    kind: "add",
    at: design === null ? { x: 0, y: 0 } : { x: design.at.x + design.size.width + 60, y: design.at.y },
    fromBoardId: design?.id ?? null,
    said: `An AI image board was added for ${concept.title}. Select it to choose the model and press Generate.`,
  };
}
