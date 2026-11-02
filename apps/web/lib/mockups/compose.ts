import sharp from "sharp";
import { canvasFor, MOCKUP_EDGE, type CanvasSize } from "./crops";
import type { GarmentDrawings } from "./garment";
import { backdropLayer, fitted, foldedStack, ghostShade, hangerLayer, measured, rgbOf, SHADOW, shadowOf } from "./paint";
import { MOCKUP_GAP_RULE, type Crop, type GarmentSlot, type MockupScene, type SceneGap } from "./types";
import { frameAt, isMirrored, sourceViewOf, squeezeFor, turnNote, turntableAngles, viewGap } from "./views";

/**
 * Drawing a deterministic mockup (spec F-L1, "Free (deterministic, from 3D)"; acceptance:
 * "Deterministic mockups render in under 5 s, free").
 *
 * The scene says where the garment goes, and only the scene: `GarmentSlot.frame` is a fraction of
 * the canvas, so one scene works at every crop and **a person can never move the garment**, which is
 * F-L1's own rule ("Users cannot drag the print area"). The backdrop, the shadow, the hanger and the
 * folds are all painted by `paint.ts` out of nothing but colours and the garment's own outline.
 *
 * An AI scene is refused here rather than half-drawn. This workstream is the deterministic half of
 * F-L1 and makes no paid call; L3 runs the other half, and `composeMockup` says so by name.
 */

export interface MockupImage {
  readonly png: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly crop: Crop;
  readonly sceneSlug: string;
  /** Always `deterministic`: nothing in this directory can produce anything else. */
  readonly provenance: "deterministic";
  readonly ruleId: string;
  /** What the screen must say about this picture, such as a view that is a turned drawing. */
  readonly notes: readonly string[];
  /** What this picture cannot show yet, each with the rule that explains it. */
  readonly gaps: readonly SceneGap[];
}

export interface ComposeAsk {
  readonly scene: MockupScene;
  readonly drawings: GarmentDrawings;
  readonly crop?: Crop;
  readonly edge?: number;
  /** The card a chart scene draws instead of a garment, already drawn (`charts.ts`). */
  readonly card?: Uint8Array;
  /** Which frame of a turning scene to draw, in degrees. Left out: straight on. */
  readonly degrees?: number;
}

export const AI_SCENE_REFUSED = "This is an AI scene: a model lights and places it, and that is not built yet. The deterministic scenes are free and ready now.";
export const CARD_MISSING = "This scene draws a chart card, so it needs the chart to draw. Nothing was given.";

type Piece = { input: Buffer; left: number; top: number };

const boxOf = (slot: GarmentSlot, canvas: CanvasSize): CanvasSize & { left: number; top: number } => ({
  left: Math.round(slot.frame.x * canvas.width),
  top: Math.round(slot.frame.y * canvas.height),
  width: Math.max(1, Math.round(slot.frame.width * canvas.width)),
  height: Math.max(1, Math.round(slot.frame.height * canvas.height)),
});

/** The drawing a slot starts from, turned and mirrored as the view asks. */
async function turned(ask: ComposeAsk, slot: GarmentSlot, box: CanvasSize): Promise<Buffer> {
  const turn = ask.degrees === undefined ? { from: sourceViewOf(slot.view), squeeze: squeezeFor(slot.view), mirrored: isMirrored(slot.view) } : frameAt(ask.degrees);
  const source = turn.from === "back" ? ask.drawings.back : ask.drawings.front;
  const upright = await fitted(source, { width: Math.max(1, Math.round(box.width / Math.max(turn.squeeze, 0.01))), height: box.height });
  const size = await measured(upright);
  const squeezed = sharp(upright).resize({ width: Math.max(1, Math.round(size.width * turn.squeeze)), height: size.height, fit: "fill" });
  return (turn.mirrored ? squeezed.flop() : squeezed).png({ compressionLevel: 9 }).toBuffer();
}

/** The pieces one slot puts on the canvas, in the order they are laid down. */
async function piecesFor(ask: ComposeAsk, slot: GarmentSlot, canvas: CanvasSize): Promise<readonly Piece[]> {
  const box = boxOf(slot, canvas);
  if (slot.presentation === "chart") {
    if (ask.card === undefined) throw new Error(CARD_MISSING);
    const card = await fitted(ask.card, box);
    const size = await measured(card);
    return [{ input: card, left: box.left + Math.round((box.width - size.width) / 2), top: box.top + Math.round((box.height - size.height) / 2) }];
  }
  const garment = await turned(ask, slot, box);
  const size = await measured(garment);
  const left = box.left + Math.round((box.width - size.width) / 2);
  const top = box.top + Math.round((box.height - size.height) / 2);
  if (slot.presentation === "folded") {
    const stack = await foldedStack(garment, box);
    const shade = await shadowOf(stack, SHADOW.blur, SHADOW.opacity);
    return [{ input: shade, left: box.left, top: box.top + SHADOW.dy }, { input: stack, left: box.left, top: box.top }];
  }
  const shade = await shadowOf(garment);
  const dropped: Piece[] = [{ input: shade, left: left + SHADOW.dx, top: top + SHADOW.dy }];
  if (slot.presentation === "hanging") {
    const hanger = await hangerLayer({ width: size.width, height: Math.max(8, Math.round(size.height * 0.16)) }, "#6b6257");
    const hangerSize = await measured(hanger);
    dropped.unshift({ input: hanger, left, top: Math.max(0, top - Math.round(hangerSize.height * 0.72)) });
  }
  const pieces: Piece[] = [...dropped, { input: garment, left, top }];
  if (slot.presentation === "ghost") pieces.push({ input: await ghostShade(garment, size), left, top });
  return pieces;
}

const notesOf = (scene: MockupScene): readonly string[] =>
  [...new Set(scene.slots.map((slot) => turnNote(slot.view)).filter((note): note is string => note !== null))];

const gapsOf = (scene: MockupScene): readonly SceneGap[] => {
  const seen = new Map<string, SceneGap>();
  for (const slot of scene.slots) {
    const gap = viewGap(slot.view);
    if (gap !== null) seen.set(gap.line, gap);
  }
  return [...seen.values()];
};

/**
 * One deterministic mockup of this scene. Throws for a scene a model runs, so a caller cannot get a
 * drawn picture out of this file and pass it off as a generated one, or the other way round.
 */
export async function composeMockup(ask: ComposeAsk): Promise<MockupImage> {
  if (ask.scene.source !== "deterministic") throw new Error(AI_SCENE_REFUSED);
  const crop = ask.crop ?? ask.scene.crops[0] ?? "1:1";
  const canvas = canvasFor(crop, ask.edge ?? MOCKUP_EDGE);
  const layers = await Promise.all(ask.scene.slots.map((slot) => piecesFor(ask, slot, canvas)));
  const out = await sharp({ create: { width: canvas.width, height: canvas.height, channels: 3, background: rgbOf(ask.scene.backdrop.hex) } })
    .composite([{ input: await backdropLayer(ask.scene.backdrop, canvas), left: 0, top: 0 }, ...layers.flat()])
    .png({ compressionLevel: 9 })
    .toBuffer();
  return {
    png: new Uint8Array(out),
    width: canvas.width,
    height: canvas.height,
    crop,
    sceneSlug: ask.scene.slug,
    provenance: "deterministic",
    ruleId: MOCKUP_GAP_RULE,
    notes: notesOf(ask.scene),
    gaps: gapsOf(ask.scene),
  };
}

/**
 * Every frame of the 360° turntable F-L1 lists among the free mockups, at whole degrees round the
 * garment. The clip itself belongs to the video studio (L5); these are the stills it is cut from.
 */
export async function composeTurntable(ask: ComposeAsk, steps?: number): Promise<readonly MockupImage[]> {
  const angles = turntableAngles(steps);
  const frames: MockupImage[] = [];
  for (const degrees of angles) frames.push(await composeMockup({ ...ask, degrees }));
  return frames;
}
