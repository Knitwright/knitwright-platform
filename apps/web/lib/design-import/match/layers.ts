import type { Layer, StackColour, ViewId } from "@/lib/artwork-stack";
import { roundMm } from "@/lib/artwork-stack";
import { cmText } from "@/lib/pattern-generators";
import { REPEAT_LABEL, type PictureCut, type RepeatEstimate } from "../pattern";
import type { Params, Shift } from "./search";

/** The layers a proposal is made of. Every one is `read-from-image`, and none is drawn from a number the picture did not give. */

const common = { opacity: 1, blend: "normal" as const, provenance: "read-from-image" as const };

export const layerIds = (view: ViewId): { main: string; alternative: string } => ({ main: `pattern-${view}`, alternative: `pattern-${view}-alt` });

export interface Placed {
  readonly view: ViewId;
  readonly step: number;
  readonly colours: readonly StackColour[];
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

export function generatorLayer(
  placed: Placed,
  match: { readonly generatorId: string; readonly params: Params; readonly inkIds: readonly string[]; readonly shift: Shift; readonly movesWithDatum: boolean; readonly label: string },
): Layer {
  const params = Object.fromEntries(Object.entries(match.params).map(([id, value]) => [id, typeof value === "number" ? round1(value) : value]));
  const offsetMm = match.movesWithDatum ? { x: roundMm(-match.shift.sx * placed.step), y: roundMm(-match.shift.sy * placed.step) } : { x: 0, y: 0 };
  return {
    ...common,
    id: layerIds(placed.view).main,
    name: `All-over pattern: ${match.label}`,
    kind: "pattern",
    views: [placed.view],
    generatorId: match.generatorId,
    params,
    datum: { anchor: "chest-line", offsetMm },
    colourIds: [...match.inkIds],
  };
}

/** A picture fill. `assetId` is a stand-in until the cut picture is stored; the stand-in is `cutOf` below. */
export function pictureLayer(placed: Placed, input: { readonly id: string; readonly name: string; readonly cut: PictureCut; readonly mode: "tile" | "panel"; readonly opacity: number }): Layer {
  return {
    ...common,
    id: input.id,
    name: input.name,
    opacity: input.opacity,
    kind: "image-fill",
    views: [placed.view],
    assetId: input.cut.assetId,
    mode: input.mode,
    scale: 1,
    rotationDeg: 0,
    offsetMm: { x: roundMm(input.cut.area.minX), y: roundMm(input.cut.area.minY) },
    halfDrop: false,
    fit: "cover",
  };
}

export function cutOf(view: ViewId, name: "tile" | "panel", area: PictureCut["area"], clip: boolean): PictureCut {
  return { assetId: `${name}-${view}`, view, area, clip };
}

export function repeatOf(widthMm: number | null, heightMm: number | null): RepeatEstimate {
  return { widthMm: widthMm === null ? null : round1(widthMm), heightMm: heightMm === null ? null : round1(heightMm), label: REPEAT_LABEL };
}

/** "about 6.5 cm across and 9 cm down (estimated, check it)". */
export function repeatSentence(repeat: RepeatEstimate): string {
  const parts = [
    ...(repeat.widthMm === null ? [] : [`${cmText(repeat.widthMm)} across`]),
    ...(repeat.heightMm === null ? [] : [`${cmText(repeat.heightMm)} down`]),
  ];
  return `The repeat is about ${parts.join(" and ")} (${repeat.label}).`;
}
