import { DEFAULT_SETTINGS } from "@/lib/guardrails/settings";
import { ruleIdFor } from "@/lib/validation/rules";
import { crossingBounds } from "./layers";
import type { RepeatDraft } from "./types";
import { effectiveDpi, tileInRange, tileRangeSentence } from "./units";

/**
 * What is wrong with a repeat, in the words the panel shows. Every finding carries the rulebook
 * entry behind it (spec decision 11); a check the rulebook has no words for yet carries
 * `R-GAP-000` through `ruleIdFor`, and those codes are listed on the pull request.
 *
 * The resolution bar is the guardrails' own setting (150 DPI, Knitwright default), not a second
 * number typed in here, so a repeat and a piece of artwork are judged by the same bar.
 */

export type RepeatFinding = Readonly<{
  code: string;
  ruleId: string;
  severity: "blocker" | "warning";
  message: string;
  action: string;
  /** The layer the finding is about, or null when it is about the whole tile. */
  layerId: string | null;
}>;

const NAME_MAX = 80;

const finding = (input: Omit<RepeatFinding, "ruleId" | "layerId"> & { layerId?: string | null }): RepeatFinding => ({
  ...input,
  ruleId: ruleIdFor(input.code),
  layerId: input.layerId ?? null,
});

const nameFindings = (draft: RepeatDraft): readonly RepeatFinding[] => {
  const name = draft.name.trim();
  if (name.length === 0)
    return [finding({ code: "repeat-no-name", severity: "blocker", message: "This repeat has no name yet.", action: "Give it a name so you can find it in your library." })];
  if (name.length > NAME_MAX)
    return [finding({ code: "repeat-no-name", severity: "blocker", message: `A name has at most ${NAME_MAX} characters.`, action: "Shorten the name." })];
  return [];
};

const tileFindings = (draft: RepeatDraft): readonly RepeatFinding[] =>
  tileInRange(draft.tile.widthTenths) && tileInRange(draft.tile.heightTenths)
    ? []
    : [finding({ code: "repeat-tile-out-of-range", severity: "blocker", message: "The tile is outside the size we can print.", action: tileRangeSentence(draft.unit) })];

const layerFindings = (draft: RepeatDraft): readonly RepeatFinding[] => {
  if (draft.layers.length === 0)
    return [finding({ code: "repeat-no-layers", severity: "blocker", message: "The tile has nothing on it yet.", action: "Upload a picture or draw a shape." })];
  const crossing = draft.wrap ? [] : crossingBounds(draft);
  return crossing.map((id) => {
    const layer = draft.layers.find((entry) => entry.id === id);
    return finding({
      code: "repeat-layer-outside-tile",
      severity: "warning",
      message: `${layer?.label ?? "A layer"} crosses the tile's edge, so the repeat will cut it.`,
      action: "Move it inside the tile, or turn on “Join at the edges” so it comes back on the other side.",
      layerId: id,
    });
  });
};

const dpiFindings = (draft: RepeatDraft): readonly RepeatFinding[] => {
  const bar = DEFAULT_SETTINGS.minDpi.value;
  return draft.layers.flatMap((layer) => {
    if (!layer.sourcePx) return [];
    const dpi = effectiveDpi(layer.sourcePx.width, layer.widthTenths);
    if (dpi >= bar) return [];
    return [
      finding({
        code: "repeat-min-dpi",
        severity: "warning",
        message: `${layer.label} is ${dpi} DPI at this size, under the ${bar} DPI we print to.`,
        action: "Make it smaller on the tile, or upload a larger picture.",
        layerId: layer.id,
      }),
    ];
  });
};

/** Everything wrong with the repeat, blockers first, in a fixed order so the list never jumps about. */
export function repeatFindings(draft: RepeatDraft): readonly RepeatFinding[] {
  const all = [...nameFindings(draft), ...tileFindings(draft), ...layerFindings(draft), ...dpiFindings(draft)];
  return [...all.filter((entry) => entry.severity === "blocker"), ...all.filter((entry) => entry.severity === "warning")];
}

/** True when nothing blocks publishing. Warnings do not block: they are shown and the person decides. */
export const publishBlocked = (draft: RepeatDraft): boolean => repeatFindings(draft).some((entry) => entry.severity === "blocker");

/** The rulebook entries this module can name, for the pull request's list of gaps. */
export const REPEAT_FINDING_CODES: readonly string[] = ["repeat-no-name", "repeat-tile-out-of-range", "repeat-no-layers", "repeat-layer-outside-tile", "repeat-min-dpi"];
