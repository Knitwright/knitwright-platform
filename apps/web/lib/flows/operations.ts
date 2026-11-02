import { aspectOf, MAX_ARTBOARD_PX, presetSize, type ArtboardPreset, type BoardView, type Graph, type Size } from "@/lib/launch";
import { carriesGenerated } from "./artwork";
import { boardGeneration, type FlowCostSource } from "./cost";
import { FLOW_GAP_RULE } from "./types";

/**
 * Flatten, Upscale and Reframe: the three items the spec puts behind "more" on a board's task bar
 * (Launch shell, F-L4).
 *
 * Each one is a change to the board's own settings followed by a rerun, which means each one goes
 * through the run engine and so through the garment lock, the estimate and the refund. None of them
 * is a new kind of picture:
 *
 *   * **Flatten** is the spec's "Convert to image": the board stops following the design and keeps
 *     the picture it has, so a downstream board can take it. It is free, and **it never changes
 *     where the picture came from** -- flattening an AI board gives a flattened AI picture, which is
 *     still scenery and still cannot become artwork.
 *   * **Upscale** makes the same picture bigger. For a board the platform draws, that is another
 *     render at a larger size and free. For a generated picture it is a model, and costs.
 *   * **Reframe** puts the same picture at another aspect, from the artboard rows. Free when the
 *     platform can draw it again at that shape, paid when a model has to fill the new edges in.
 *
 * Every refusal carries the bound or the reason in its own words, and a size outside what the canvas
 * can draw is refused with the bound in the message rather than quietly clamped (decision 0091,
 * item 7).
 */

export const OPERATIONS = ["flatten", "upscale", "reframe"] as const;
export type OperationId = (typeof OPERATIONS)[number];

export const OPERATION_LABELS: Readonly<Record<OperationId, string>> = {
  flatten: "Flatten",
  upscale: "Upscale",
  reframe: "Reframe",
};

export const OPERATION_LEADS: Readonly<Record<OperationId, string>> = {
  flatten: "Keep the picture this board has now, so it stops following the design and another board can take it.",
  upscale: "Make the same picture bigger, up to the largest size the canvas draws.",
  reframe: "Put the same picture at another shape, from the artboard sizes.",
};

export type OperationVerdict = Readonly<{ allowed: true }> | Readonly<{ allowed: false; reason: string; ruleId: string }>;

const refuse = (reason: string): OperationVerdict => ({ allowed: false, reason, ruleId: FLOW_GAP_RULE });

/** The factors Upscale offers. Two and four, as the image modal of F-L1 and F-L2 offers them. */
export const DEFAULT_UPSCALE = 2;
export const UPSCALE_FACTORS: readonly number[] = [DEFAULT_UPSCALE, 4];

export interface OperationInput {
  readonly graph: Graph;
  readonly board: BoardView;
  readonly source: FlowCostSource;
  readonly presets: readonly ArtboardPreset[];
  /** For Upscale: how much bigger. For Reframe: the preset key of the new shape. */
  readonly factor?: number;
  readonly presetKey?: string;
}

/** Whether a board has a picture to work on at all. The first thing all three ask. */
function hasPicture(board: BoardView): OperationVerdict {
  if (board.status !== "ready" || board.outputFileId === null) {
    return refuse("Run this board first: there is no picture to work on yet.");
  }
  return { allowed: true };
}

const upscaleSize = (size: Size, factor: number): Size => ({ width: Math.round(size.width * factor), height: Math.round(size.height * factor) });

function upscaleVerdict(input: OperationInput): OperationVerdict {
  const picture = hasPicture(input.board);
  if (!picture.allowed) return picture;
  const factor = input.factor ?? DEFAULT_UPSCALE;
  if (!UPSCALE_FACTORS.includes(factor)) return refuse(`Upscale goes ${UPSCALE_FACTORS.join(" or ")} times, not ${factor}.`);
  const wanted = upscaleSize(input.board.size, factor);
  if (Math.max(wanted.width, wanted.height) > MAX_ARTBOARD_PX) {
    return refuse(`That would be ${Math.max(wanted.width, wanted.height)} px and the largest artboard is ${MAX_ARTBOARD_PX} px. Try a smaller factor.`);
  }
  return { allowed: true };
}

function reframeVerdict(input: OperationInput): OperationVerdict {
  const picture = hasPicture(input.board);
  if (!picture.allowed) return picture;
  if (input.presetKey === undefined) return refuse("Choose the shape to reframe to.");
  const preset = input.presets.find((one) => one.key === input.presetKey);
  if (!preset) return refuse("That artboard size is not one of the sizes a platform admin keeps.");
  if (aspectOf(presetSize(preset)) === aspectOf(input.board.size)) return refuse("This board is already that shape.");
  return { allowed: true };
}

/** Whether an operation may be carried out on a board now. */
export function operationVerdict(id: OperationId, input: OperationInput): OperationVerdict {
  if (id === "flatten") return hasPicture(input.board);
  if (id === "upscale") return upscaleVerdict(input);
  return reframeVerdict(input);
}

/**
 * What an operation costs. A board the platform draws itself is redrawn, which is free; a picture a
 * model made has to go through a model again. Flatten never costs: nothing is made, the board keeps
 * what it has.
 */
export function operationCost(id: OperationId, input: OperationInput): number {
  if (id === "flatten") return 0;
  const generated = boardGeneration(input.board) === "model" || carriesGenerated(input.graph, input.board.id);
  if (!generated) return 0;
  return Math.max(0, Math.round(input.source.perGeneratedBoard));
}

export interface OperationPlan {
  readonly id: OperationId;
  readonly boardId: string;
  readonly label: string;
  readonly credits: number;
  /** The board's settings after the change. Saved, and then the board is rerun from them. */
  readonly settings: Readonly<Record<string, unknown>>;
  /** The board's size after the change. Unchanged for Flatten. */
  readonly size: Size;
  /** What the person is told before it happens, including what it costs. */
  readonly note: string;
  readonly ruleId: string;
}

const money = (credits: number): string => (credits === 0 ? "free" : `${credits} ${credits === 1 ? "credit" : "credits"}`);

/**
 * The change an operation makes, or null when it cannot be made. The caller saves the settings
 * through the launch shell and reruns the board, so an operation is charged, refunded and recorded
 * exactly like any other run.
 */
export function planOperation(id: OperationId, input: OperationInput): OperationPlan | null {
  if (!operationVerdict(id, input).allowed) return null;
  const credits = operationCost(id, input);
  const base = { id, boardId: input.board.id, label: OPERATION_LABELS[id], credits, ruleId: FLOW_GAP_RULE };
  if (id === "flatten") {
    return {
      ...base,
      settings: { ...input.board.settings, flattened: true, followsDesign: false },
      size: input.board.size,
      note: `Flatten keeps the picture this board has now (${money(credits)}). It stops following the design, and where the picture came from does not change.`,
    };
  }
  if (id === "upscale") {
    const factor = input.factor ?? DEFAULT_UPSCALE;
    return {
      ...base,
      settings: { ...input.board.settings, upscale: factor },
      size: upscaleSize(input.board.size, factor),
      note: `Upscale ${factor}× to ${upscaleSize(input.board.size, factor).width} px wide (${money(credits)}).`,
    };
  }
  // Reframe. `reframeVerdict` has already found the row, so it is here.
  const preset = input.presets.find((one) => one.key === input.presetKey) as ArtboardPreset;
  const size = presetSize(preset);
  return {
    ...base,
    settings: { ...input.board.settings, aspect: aspectOf(size), preset: preset.key },
    size,
    note: `Reframe to ${preset.label}, ${size.width} by ${size.height} px (${money(credits)}). ${preset.note}`.trim(),
  };
}

export interface OperationOffer {
  readonly id: OperationId;
  readonly label: string;
  readonly lead: string;
  readonly credits: number;
  /** Why it cannot be used now, or null. The button stays on screen and says why it is off. */
  readonly blocked: string | null;
  readonly ruleId: string;
}

/** The three items of the board task bar, each with its cost and, when it is off, why. */
export function operationsFor(input: OperationInput): readonly OperationOffer[] {
  return OPERATIONS.map((id) => {
    const verdict = operationVerdict(id, input);
    return {
      id,
      label: OPERATION_LABELS[id],
      lead: OPERATION_LEADS[id],
      credits: operationCost(id, input),
      blocked: verdict.allowed ? null : verdict.reason,
      ruleId: FLOW_GAP_RULE,
    };
  });
}
