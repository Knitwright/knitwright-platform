import { PLACE_DEFINITIONS } from "@/lib/garment";
import type { PlayerMarkLayer, PointMm, TextLayer, ViewId } from "@/lib/artwork-stack";
import type { Shape } from "../geometry/boolean";
import { boundsOf, type Pt } from "../geometry/vec";
import { colourProblem, numberProblems, textHeightProblem } from "../rules";
import { STANDARD_CLEAR_SPACE_MM } from "../zones";
import { textShapes } from "../text/font";
import { FALLBACK_INK, screenColour, type BuildEnv } from "./context";
import { emptyPlan, turnedRect, type MarkPlan } from "./marks";
import { OUTSIDE_ZONES_SENTENCE, isProblem, resolvePlace, templateFor, type ResolvedPlace } from "./placement";
import type { PrintSpace } from "./print-space";
import type { FilledShape, Issue, PlayerTag } from "./scene";

interface Where {
  readonly view: ViewId;
  readonly size: string;
  readonly space: PrintSpace;
  readonly index: number;
}

/**
 * Heights used when a design did not state one. They are settings, not measurements, and the margin says "Knitwright
 * default" whenever one is used (open item P7 holds the league's own numbers).
 */
export const DEFAULT_MARK_HEIGHT_MM = { "back-name": 30, "back-number": 250, "front-number": 100, "leg-number": 80 } as const;
export const DEFAULT_TEXT_HEIGHT_MM = 30;

interface Ink {
  readonly shapes: readonly FilledShape[];
  readonly core: readonly PointMm[];
  readonly widthMm: number;
  readonly missing: readonly string[];
}

/** Text as shapes on the plane, centred on a point, turned clockwise, then carried to print space. */
function inkOf(env: BuildEnv, space: PrintSpace, text: string, heightMm: number, centre: PointMm, rotationDeg: number, fill: string): Ink {
  const run = textShapes(env.font, text, { heightMm, align: "centre" });
  const r = (rotationDeg * Math.PI) / 180;
  const [c, s] = [Math.cos(r), Math.sin(r)];
  const onPlane = (x: number, y: number): PointMm => {
    const [u, v] = [x, heightMm / 2 - y];
    return { x: centre.x + u * c - v * s, y: centre.y + u * s + v * c };
  };
  const shapes = run.shapes.map((glyph): FilledShape => ({ fill, shape: glyph.map((ring) => ring.map(([x, y]) => space.toPrint(onPlane(x, y)))) as Shape }));
  return { shapes, core: turnedRect(centre, Math.max(run.width, 0.01), heightMm, rotationDeg), widthMm: run.width, missing: run.missing };
}

function colourOf(env: BuildEnv, colourId: string | undefined, layerId: string, issues: Issue[]): string {
  const found = screenColour(env, colourId);
  if (found === null) {
    issues.push({ code: "no-colour", layerId, text: colourId === undefined ? "No colour is set for this lettering, so it is printed in black." : `Colour ${colourId} has no screen colour, so this lettering is printed in black.` });
    return FALLBACK_INK;
  }
  const bad = colourProblem(found, env.rules);
  if (bad !== null) issues.push({ code: "colour-avoid", layerId, text: bad });
  return found;
}

const missingIssues = (missing: readonly string[], layerId: string): Issue[] =>
  missing.length === 0 ? [] : [{ code: "missing-glyph", layerId, text: `The lettering font has no ${[...new Set(missing)].map((m) => `"${m}"`).join(", ")}, so it is left blank. Check the spelling.` }];

/** Text on a zone or anchor: outlined from the bundled font, held to the minimum height. */
export async function planText(env: BuildEnv, layer: TextLayer, where: Where): Promise<MarkPlan> {
  const place = resolvePlace(env, where.view, where.size, layer.placement);
  if (isProblem(place)) return emptyPlan(layer.id, where.index, [{ code: "not-placed", layerId: layer.id, text: place.problem }]);
  const issues: Issue[] = [];
  const centre: PointMm = { x: place.centre.x + layer.offsetMm.x, y: place.centre.y + layer.offsetMm.y };
  const fill = colourOf(env, layer.colourId, layer.id, issues);
  const ink = inkOf(env, where.space, layer.text, layer.heightMm, centre, layer.rotationDeg, fill);
  const small = textHeightProblem(layer.heightMm, env.rules);
  if (small !== null) issues.push({ code: "text-too-small", layerId: layer.id, text: small });
  if (layer.widthMm !== undefined && ink.widthMm > layer.widthMm + 0.01) {
    issues.push({ code: "larger-than-zone", layerId: layer.id, text: `The text "${layer.text}" is ${Math.round(ink.widthMm)} mm wide at ${layer.heightMm} mm tall, but it is meant to be ${Math.round(layer.widthMm)} mm wide. It was not squeezed.` });
  }
  if (place.outsideStandardZones) issues.push({ code: "outside-zones", layerId: layer.id, text: OUTSIDE_ZONES_SENTENCE(`The text "${layer.text}"`) });
  return {
    layerId: layer.id,
    index: where.index,
    shapes: ink.shapes,
    images: null,
    core: ink.core,
    ownClearMm: place.clearSpaceMm,
    cuts: true,
    paintsNothing: layer.blend === "knock-out",
    issues: [...issues, ...missingIssues(ink.missing, layer.id)],
    notes: [],
    lowestDpi: null,
  };
}

function markText(layer: PlayerMarkLayer, shows: "name" | "number", player: PlayerTag | undefined): { text: string; sample: boolean } {
  if (player !== undefined) return { text: shows === "name" ? player.name : player.number, sample: false };
  const sample = layer.sample;
  return { text: sample === undefined ? "" : shows === "name" ? sample.name : sample.number, sample: true };
}

function fitIssues(layer: PlayerMarkLayer, env: BuildEnv, ink: Ink, heightMm: number, place: ResolvedPlace, shows: "name" | "number", text: string): Issue[] {
  const found: Issue[] = [];
  const zone = place.zoneSize;
  if (zone !== null && (ink.widthMm > zone.widthMm + 0.01 || heightMm > zone.heightMm + 0.01)) {
    const code = shows === "name" ? "name-does-not-fit" : "number-does-not-fit";
    found.push({
      code,
      layerId: layer.id,
      text: `${shows === "name" ? "The name" : "The number"} "${text}" is ${Math.round(ink.widthMm)} mm wide at ${heightMm} mm tall, but its place is ${Math.round(zone.widthMm)} mm wide and ${Math.round(zone.heightMm)} mm tall. It was not squeezed.`,
    });
  }
  const low = textHeightProblem(heightMm, env.rules);
  if (low !== null) found.push({ code: "text-too-small", layerId: layer.id, text: low });
  if (shows === "number") for (const t of numberProblems(text, heightMm, env.rules)) found.push({ code: "rule", layerId: layer.id, text: t });
  return found;
}

/** A player's name or number on its place. The name and number come from the roster; the design only says how. */
export async function planPlayerMark(env: BuildEnv, layer: PlayerMarkLayer, where: Where, player: PlayerTag | undefined): Promise<MarkPlan> {
  const shows = PLACE_DEFINITIONS[layer.place].shows;
  const t = templateFor(env, where.view, layer.place);
  if (t === undefined) {
    return emptyPlan(layer.id, where.index, [{ code: "not-placed", layerId: layer.id, text: `This pattern has no place for the ${layer.place.replaceAll("-", " ")} on the ${where.view.replace("-", " ")}, so it was not placed.` }]);
  }
  const place = resolvePlace(env, where.view, where.size, { kind: "zone", zoneId: t.id });
  if (isProblem(place)) return emptyPlan(layer.id, where.index, [{ code: "not-placed", layerId: layer.id, text: place.problem }]);
  const { text, sample } = markText(layer, shows, player);
  if (text === "") return emptyPlan(layer.id, where.index, []);
  const issues: Issue[] = [];
  const heightMm = layer.heightMm ?? DEFAULT_MARK_HEIGHT_MM[layer.place];
  const fill = colourOf(env, layer.colourId, layer.id, issues);
  const ink = inkOf(env, where.space, text, heightMm, place.centre, 0, fill);
  const notes = [
    ...(layer.heightMm === undefined ? [`The ${layer.place.replaceAll("-", " ")} height was not set: ${heightMm} mm (Knitwright default).`] : []),
    ...(sample ? [`The ${shows} shown is the design's sample, not a player.`] : []),
  ];
  return {
    layerId: layer.id,
    index: where.index,
    shapes: ink.shapes,
    images: null,
    core: ink.core,
    ownClearMm: place.clearSpaceMm || STANDARD_CLEAR_SPACE_MM,
    cuts: true,
    paintsNothing: false,
    issues: [...issues, ...fitIssues(layer, env, ink, heightMm, place, shows, text), ...missingIssues(ink.missing, layer.id)],
    notes,
    lowestDpi: null,
  };
}

export const boundsOfInk = (plan: MarkPlan): ReturnType<typeof boundsOf> | null =>
  plan.shapes.length === 0 ? null : boundsOf(plan.shapes.flatMap((s) => s.shape.flat() as Pt[]));
