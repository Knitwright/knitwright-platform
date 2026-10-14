import { PLACE_DEFINITIONS } from "@/lib/garment/names-numbers";
import type { PlayerMarkLayer, TextLayer } from "@/lib/artwork-stack";
import { growRing } from "../../geometry/clip";
import { applyAll, compose, rotation, translation, type Affine, type Pt } from "../../geometry/affine";
import { boundsOf } from "../../geometry/polygon";
import type { FillItem, PrintIssue, Ring } from "../../scene";
import { fitText, numberIssues, textHeightIssues } from "../../rules/checks";
import { outlineText } from "../../text/outline";
import { screenColour } from "../colours";
import { markReport, resolvePlacement } from "../placement";
import type { Built, LayerResult, LayerSpace } from "../types";

/** Heights a mark is drawn at when its layer gives none. Knitwright defaults, said in the file. */
export const DEFAULT_MARK_HEIGHT_MM = { "back-name": 60, "back-number": 200, "front-number": 100, "leg-number": 80 } as const;

const NO_COLOUR = "#000000";

/** Text outlines centred on a design point and turned about it, placed on the piece. */
function textRings(text: string, heightMm: number, centre: Pt, turnDeg: number, space: LayerSpace): { rings: Ring[]; box: Ring } {
  const out = outlineText(text, heightMm);
  // Glyphs are y up from the baseline; the design plane is y down. Centre the text box on the origin, flipping y.
  const centred: Affine = [1, 0, 0, -1, -out.widthMm / 2, heightMm / 2];
  const local = compose(translation(centre[0], centre[1]), compose(rotation((turnDeg * Math.PI) / 180), centred));
  const onPiece = compose(space.toPiece, local);
  const corners: Pt[] = [[0, 0], [out.widthMm, 0], [out.widthMm, heightMm], [0, heightMm]];
  return { rings: out.rings.map((ring) => applyAll(onPiece, ring)), box: applyAll(onPiece, corners) };
}

function fillOf(layerId: string, rings: Ring[], colour: string, opacity: number, blend: FillItem["blend"]): FillItem {
  return { kind: "fill", layerId, rings, colour, opacity, blend };
}

/** Free text on a garment: a sponsor line, a club name. */
export function textLayer(layer: TextLayer, space: LayerSpace): LayerResult {
  const where = resolvePlacement(layer.placement, space);
  if ("issue" in where) return { built: [], knock: [], colours: [], dpis: [], issues: [where.issue] };
  const { placed } = where;
  const { input } = space;
  const colour = layer.colourId ? screenColour(input.stack, input.colourwayId, layer.colourId) : { hex: NO_COLOUR, issue: null };
  const centre: Pt = [placed.centre.x + layer.offsetMm.x, placed.centre.y + layer.offsetMm.y];
  const label = layer.name ?? layer.id;
  const zoneWidth = placed.zonePolygon ? widthOfZone(placed.zonePolygon, space) : null;
  const fit = zoneWidth === null ? null : fitText(layer.text, layer.heightMm, zoneWidth, input.rules, label);
  const height = fit ? fit.heightMm : layer.heightMm;
  const issues: PrintIssue[] = [...(fit?.issues ?? textHeightIssues(layer.heightMm, input.rules, label)), ...(colour.issue ? [colour.issue] : [])];
  if (height === null) return { built: [], knock: [], colours: [colour.hex], dpis: [], issues };
  const made = textRings(layer.text, height, centre, layer.rotationDeg, space);
  const report = markReport(layer.id, made.box, placed, space);
  const built: Built[] = [{ kind: "text", item: fillOf(layer.id, made.rings, colour.hex, layer.opacity, layer.blend) }];
  const clear = placed.zone?.clearSpaceMm ?? 0;
  const knock = clear > 0 && layer.blend !== "knock-out" ? [growRing(made.box, clear, "miter")] : [];
  return { built, knock, issues: [...issues, ...report.issues], colours: [colour.hex], dpis: [], marks: [report.mark] };
}

/** The width of a zone along the design x axis. */
function widthOfZone(polygon: Ring, space: LayerSpace): number {
  const box = boundsOf(applyAll(space.toDesign, polygon));
  return box.maxX - box.minX;
}

function heightOfZone(polygon: Ring, space: LayerSpace): number {
  const box = boundsOf(applyAll(space.toDesign, polygon));
  return box.maxY - box.minY;
}

/**
 * A player's name or number in its place. The whole place is cleared of pattern and keeps its clear space, whoever the
 * player is, so every player's file has the same pattern. With no player the place is only cleared, and the file says so.
 */
export function playerMarkLayer(layer: PlayerMarkLayer, space: LayerSpace): LayerResult {
  const { input } = space;
  const zoneId = layer.place;
  const where = resolvePlacement({ kind: "zone", zoneId }, space);
  if ("issue" in where) return { built: [], knock: [], colours: [], dpis: [], issues: [{ severity: "warn", text: `There is no place for ${PLACE_DEFINITIONS[layer.place].label.toLowerCase()} on this garment, so it was left off.` }] };
  const { placed } = where;
  const polygon = placed.zonePolygon as Ring;
  const knock = [growRing(polygon, placed.zone?.clearSpaceMm ?? 0, "miter")];
  const shows = PLACE_DEFINITIONS[layer.place].shows;
  const colour = layer.colourId ? screenColour(input.stack, input.colourwayId, layer.colourId) : { hex: NO_COLOUR, issue: null };
  const base: LayerResult = { built: [], knock, issues: colour.issue ? [colour.issue] : [], colours: [colour.hex], dpis: [] };
  const player = input.player;
  if (!player) return base;
  const text = shows === "name" ? player.name : player.number;
  if (text === "") return base;
  const wanted = Math.min(layer.heightMm ?? DEFAULT_MARK_HEIGHT_MM[layer.place], heightOfZone(polygon, space));
  const label = `${shows === "name" ? "Name" : "Number"} ${text}`;
  const fit = fitText(text, wanted, widthOfZone(polygon, space), input.rules, label);
  const extra = shows === "number" && fit.heightMm !== null ? numberIssues(text, fit.heightMm, input.rules) : [];
  const issues = [...base.issues, ...fit.issues, ...extra];
  if (fit.heightMm === null) return { ...base, issues };
  const made = textRings(text, fit.heightMm, [placed.centre.x, placed.centre.y], 0, space);
  const report = markReport(layer.id, made.box, placed, space);
  const built: Built[] = [{ kind: "player-mark", item: fillOf(layer.id, made.rings, colour.hex, layer.opacity, layer.blend) }];
  return { ...base, built, issues: [...issues, ...report.issues], marks: [report.mark] };
}
