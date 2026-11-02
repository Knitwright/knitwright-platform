import { garmentSource, inputsOf, type BoardView, type LaunchContext } from "@/lib/launch";
import {
  CHARGING_OFF_NOTE,
  runVerdict,
  type AiVideoSettings,
  type RunVerdict,
} from "@/lib/media/video/ai-board";
import { DURATION_BOUNDS, VIDEO_ASPECTS, VIDEO_FORMATS, type VideoAspect } from "@/lib/media/video/formats";
import { audioAvailable, CATALOGUE_NOTE, estimatedWait, findModel, licenceLabel, videoCost, type VideoModel } from "@/lib/media/video/models";
import { PRESETS, type PresetKey } from "@/lib/media/video/prompt-presets";
import * as copy from "./copy";

/**
 * THE AI VIDEO PANEL AS A VALUE (panel id `board-ai-video`, L1's contract).
 *
 * The panel component draws this and asks the shell for things; it decides nothing. So everything
 * that could be wrong -- an empty state that does not name an action, a cost on a button nobody has
 * priced, an Audio switch on a model with no sound, a Generate button on a board with no garment
 * behind it -- is decided here, where a test can read it without a shell and without a browser.
 *
 * The lock is read from the project the shell already gave us (`garmentSource`, `inputsOf`), never
 * from a fetch: a panel never fetches (L1's contract).
 */

export interface EmptyState {
  readonly title: string;
  readonly line: string;
  readonly action: string;
}

export interface FrameState {
  readonly label: string;
  readonly filled: boolean;
  /** The board that feeds this input, or the sentence saying nothing does. */
  readonly from: string | null;
  readonly line: string | null;
}

export interface PresetCard {
  readonly key: PresetKey;
  readonly label: string;
  readonly lead: string;
  readonly selected: boolean;
}

export interface ModelCard {
  readonly key: string;
  readonly label: string;
  readonly lead: string;
  /** "About 1:00 of waiting", from the model's own estimate. */
  readonly wait: string;
  /** The credits a second, or the sentence saying nobody has set one. */
  readonly price: string;
  readonly licence: string;
  readonly commercialLicence: boolean;
  readonly selected: boolean;
}

export interface AspectChoice {
  readonly aspect: VideoAspect;
  readonly label: string;
  readonly selected: boolean;
}

export interface PanelView {
  readonly heading: string;
  readonly lead: string;
  /** The one empty state in the way, or null when the panel can be used. */
  readonly empty: EmptyState | null;
  readonly frames: Readonly<{ first: FrameState; end: FrameState }>;
  readonly presets: readonly PresetCard[];
  readonly prompt: string;
  readonly models: readonly ModelCard[];
  readonly modelsLine: string | null;
  readonly aspects: readonly AspectChoice[];
  readonly duration: Readonly<{ seconds: number; min: number; max: number; note: string }>;
  readonly audio: Readonly<{ on: boolean; available: boolean; note: string | null }>;
  readonly run: Readonly<{ label: string; disabled: boolean; reason: string | null }>;
  /** Every note the person must see: the placeholder prices, the catalogue, charging being off. */
  readonly notes: readonly string[];
  /** The chosen model's own estimate of the whole wait, in milliseconds, or null. */
  readonly estimateMs: number | null;
  readonly busy: boolean;
}

export interface PanelInput {
  readonly context: LaunchContext;
  readonly settings: AiVideoSettings;
  readonly models: readonly VideoModel[];
  /** `CREDITS_ENFORCED`. Off today, and the panel says so rather than pretending otherwise. */
  readonly creditsEnforced: boolean;
  /** Model keys an admin offered that nothing describes, so the panel can name them. */
  readonly unknownModels?: readonly string[];
}

const clockOf = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** The boards feeding the two frame inputs: input 1 is the first frame, input 2 the end frame. */
export function framesOf(context: LaunchContext, board: BoardView): Readonly<{ first: BoardView | null; end: BoardView | null }> {
  const graph = { boards: context.project.boards, edges: context.project.edges };
  const byIndex = (index: number): BoardView | null => {
    const edge = inputsOf(graph, board.id).find((one) => one.inputIndex === index);
    return edge ? (context.project.boards.find((one) => one.id === edge.fromBoardId) ?? null) : null;
  };
  return { first: byIndex(1), end: byIndex(2) };
}

const frameState = (label: string, board: BoardView | null, optional: string | null): FrameState => ({
  label,
  filled: board !== null,
  from: board ? board.name || board.kind.replaceAll("_", " ") : null,
  line: board ? optional : (optional ?? copy.FRAME_EMPTY_LINE),
});

const presetCards = (settings: AiVideoSettings): readonly PresetCard[] =>
  PRESETS.map((preset) => ({ key: preset.key, label: preset.label, lead: preset.lead, selected: settings.presetKey === preset.key }));

const modelCards = (models: readonly VideoModel[], settings: AiVideoSettings): readonly ModelCard[] =>
  models.map((model) => {
    const cost = videoCost(model, settings.seconds);
    return {
      key: model.key,
      label: model.label,
      lead: model.lead,
      wait: `About ${clockOf(estimatedWait(model, settings.seconds))} of waiting`,
      price: cost.priced ? `${cost.perSecond} credits a second` : copy.COST_UNKNOWN,
      licence: licenceLabel(model),
      commercialLicence: model.commercialLicence,
      selected: settings.modelKey === model.key,
    };
  });

const aspectChoices = (settings: AiVideoSettings): readonly AspectChoice[] =>
  VIDEO_ASPECTS.map((aspect) => ({ aspect, label: VIDEO_FORMATS[aspect].label, selected: settings.aspect === aspect }));

/** The one thing in the way, in the order a person would fix it. */
function emptyOf(context: LaunchContext, board: BoardView | null, locked: boolean, hasFirst: boolean): EmptyState | null {
  if (!board) return copy.EMPTY_NO_BOARD;
  if (!locked) return copy.EMPTY_NO_DESIGN;
  if (!hasFirst) return copy.EMPTY_NO_FRAME;
  return null;
}

function notesOf(input: PanelInput, verdict: RunVerdict): readonly string[] {
  const notes = [copy.PLACEHOLDER_NOTICE, CATALOGUE_NOTE];
  if (!input.creditsEnforced) notes.push(CHARGING_OFF_NOTE);
  if (input.context.credits === null && input.creditsEnforced) notes.push(copy.BALANCE_UNKNOWN);
  if (!verdict.canRun && input.context.busy) notes.push(copy.BUSY_LINE);
  return notes;
}

const modelsLine = (models: readonly VideoModel[], unknown: readonly string[]): string | null => {
  if (models.length === 0) return copy.MODEL_NONE_LINE;
  return unknown.length === 0 ? null : `${copy.MODEL_UNKNOWN_LINE} ${unknown.join(", ")}.`;
};

/** Everything the panel draws. Pure: the same context and settings always give the same view. */
export function panelView(input: PanelInput): PanelView {
  const board = input.context.selection?.board ?? null;
  const graph = { boards: input.context.project.boards, edges: input.context.project.edges };
  const locked = board ? garmentSource(graph, board.id).locked : false;
  const frames = board ? framesOf(input.context, board) : { first: null, end: null };
  const model = findModel(input.models, input.settings.modelKey);
  const verdict = runVerdict(input.settings, input.models, {
    garmentLocked: locked,
    hasFirstFrame: frames.first !== null,
    balance: input.context.credits,
    creditsEnforced: input.creditsEnforced,
  });
  return {
    heading: copy.PANEL_HEADING,
    lead: copy.PANEL_LEAD,
    empty: emptyOf(input.context, board, locked, frames.first !== null),
    frames: {
      first: frameState(copy.FIRST_FRAME_LABEL, frames.first, null),
      end: frameState(copy.END_FRAME_LABEL, frames.end, copy.END_FRAME_OPTIONAL),
    },
    presets: presetCards(input.settings),
    prompt: input.settings.prompt,
    models: modelCards(input.models, input.settings),
    modelsLine: modelsLine(input.models, input.unknownModels ?? []),
    aspects: aspectChoices(input.settings),
    duration: { seconds: input.settings.seconds, min: DURATION_BOUNDS.minSeconds, max: DURATION_BOUNDS.maxSeconds, note: DURATION_BOUNDS.note },
    audio: {
      on: input.settings.audio && model !== null && audioAvailable(model),
      available: model !== null && audioAvailable(model),
      note: model && !audioAvailable(model) ? copy.AUDIO_UNAVAILABLE : null,
    },
    run: {
      label: verdict.canRun ? verdict.cost.label : copy.RUN_HEADING,
      disabled: !verdict.canRun || input.context.busy,
      reason: verdict.canRun ? null : verdict.reason,
    },
    notes: notesOf(input, verdict),
    estimateMs: model === null ? null : estimatedWait(model, input.settings.seconds) * 1000,
    busy: input.context.busy,
  };
}
