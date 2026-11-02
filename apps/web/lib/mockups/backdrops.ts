import type { Backdrop } from "./types";

/**
 * The backdrops the mockup studio draws (plan v5 L2; spec F-L1 "e-commerce white 1:1 and 4:5,
 * studio colour backdrop").
 *
 * **Every one of them is drawn by us.** No photograph, texture, font or model is committed to this
 * repository (plan v5 rules), so a scene that reads "on grass" is a plain outfield green we paint
 * ourselves and says so in its own note, rather than a picture of a field somebody else took.
 *
 * These are the seeded defaults of the scene rows: a backdrop reaches a screen out of a
 * `templates` row of kind `mockup_scene`, never out of this file, and a platform admin changes a
 * row without a deploy. Nothing here is reviewed by anyone, and every note says so.
 */

/** The sentence every backdrop of ours carries, so nobody reads it as a photograph. */
export const DRAWN_BY_US = "A plain backdrop the platform paints itself, not a photograph. Not reviewed by anyone.";

const drawn = (key: string, label: string, kind: Backdrop["kind"], hex: string, hexTwo?: string): Backdrop => ({
  key,
  label,
  kind,
  hex,
  ...(hexTwo === undefined ? {} : { hexTwo }),
  note: DRAWN_BY_US,
});

/**
 * The backdrops the seeded scenes use. A deterministic scene uses one of the first four; a scene
 * the spec marks AI-generated carries the nearest of these as the colour its placeholder is drawn
 * on, because L3 has not run it and this workstream will not pretend it has.
 */
export const BACKDROPS: Readonly<Record<string, Backdrop>> = {
  /** F-L1's "e-commerce white background". Pure white, so a listing image needs no cut-out. */
  white: drawn("white", "E-commerce white", "white", "#ffffff"),
  /** F-L1's "studio colour backdrop". A seamless paper colour, a platform admin's to change. */
  studio: drawn("studio", "Studio colour", "colour", "#dfe3e8"),
  /** A neutral table top, as the existing flat-lay render already uses (`lib/media/studio.ts`). */
  table: drawn("table", "Neutral table top", "surface", "#e6e4e1"),
  /** `07`'s "flat lay on grass": an outfield green we paint, not a picture of a pitch. */
  outfield: drawn("outfield", "Outfield green", "surface", "#4a7a3c"),
  /** A painted wall, for the hanger scene. */
  wall: drawn("wall", "Painted wall", "colour", "#cfc8bd"),
  /** A dark room, for the scenes `07` sets at night or on a stage. */
  night: drawn("night", "Dark room", "gradient", "#101722", "#263345"),
  /** A lit interior, for the changing room, the gym and the shop. */
  interior: drawn("interior", "Lit interior", "gradient", "#2b2f36", "#4a5058"),
};

export type BackdropKey = keyof typeof BACKDROPS;

/** The backdrop of this key. Unknown keys answer the e-commerce white, which hides nothing. */
export const backdropFor = (key: string): Backdrop => BACKDROPS[key] ?? BACKDROPS.white!;

/** Every backdrop, in a fixed order, for a picker and for the seed. */
export const allBackdrops = (): readonly Backdrop[] => Object.keys(BACKDROPS).sort().map((key) => BACKDROPS[key]!);
