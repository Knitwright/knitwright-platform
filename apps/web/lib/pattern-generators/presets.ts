import type { ParamValue } from "@/lib/artwork-stack/generator";

/**
 * Three named starting points per generator. A preset is a set of settings, not a picture. The old fade (`kit-fade`)
 * has no settings, so its looks are presets of the gradient. `lib/kit-styles/presets.ts` is read only for this library.
 */

export interface GeneratorPreset {
  readonly id: string;
  readonly label: string;
  readonly generatorId: string;
  readonly hint: string;
  readonly params: Readonly<Record<string, ParamValue>>;
  readonly seed?: number;
}

const preset = (generatorId: string, id: string, label: string, hint: string, params: Record<string, ParamValue>, seed?: number): GeneratorPreset => ({
  id: `${generatorId}/${id}`,
  label,
  generatorId,
  hint,
  params,
  ...(seed === undefined ? {} : { seed }),
});

export const PRESETS: readonly GeneratorPreset[] = [
  preset("kit-hoops", "narrow", "Narrow hoops", "Close bands around the body.", { bandWidthMm: 60 }),
  preset("kit-hoops", "classic", "Classic hoops", "Bands about a hand wide.", { bandWidthMm: 90 }),
  preset("kit-hoops", "wide", "Wide hoops", "Bold bands.", { bandWidthMm: 140 }),
  preset("kit-stripes", "narrow", "Narrow stripes", "Close stripes from shoulder to hem.", { bandWidthMm: 40 }),
  preset("kit-stripes", "classic", "Classic stripes", "Wide stripes from shoulder to hem.", { bandWidthMm: 70 }),
  preset("kit-stripes", "wide", "Wide stripes", "Bold stripes.", { bandWidthMm: 120 }),
  preset("kit-pinstripes", "fine", "Fine pinstripes", "Hairlines close together.", { bandWidthMm: 20 }),
  preset("kit-pinstripes", "classic", "Classic pinstripes", "Fine lines, close together.", { bandWidthMm: 32 }),
  preset("kit-pinstripes", "bold", "Bold pinstripes", "Heavier lines.", { bandWidthMm: 50 }),
  preset("kit-sash", "slim", "Slim sash", "A narrow band from shoulder to hip.", { bandWidthMm: 70 }),
  preset("kit-sash", "classic", "Classic sash", "A band from shoulder to hip.", { bandWidthMm: 110 }),
  preset("kit-sash", "wide", "Wide sash", "A broad band.", { bandWidthMm: 160 }),
  preset("kit-side-panels", "slim", "Slim side panels", "A narrow panel down each side.", { bandWidthMm: 50 }),
  preset("kit-side-panels", "classic", "Side panels", "A panel down each side.", { bandWidthMm: 80 }),
  preset("kit-side-panels", "wide", "Wide side panels", "Broad panels.", { bandWidthMm: 120 }),
  preset("kit-chest-band", "slim", "Slim chest band", "A narrow band across the chest.", { bandWidthMm: 60 }),
  preset("kit-chest-band", "classic", "Chest band", "One band across the chest.", { bandWidthMm: 90 }),
  preset("kit-chest-band", "wide", "Wide chest band", "A broad band.", { bandWidthMm: 140 }),
  preset("kit-dots", "benchmark", "Half-drop dots", "30 mm dots, every other row shifted.", { dotWidthMm: 30, pitchMm: 70, rowStepMm: 35, halfDrop: true, clearSpaceMm: 10 }),
  preset("kit-dots", "lined-up", "Lined-up dots", "Dots in straight rows and columns.", { dotWidthMm: 30, pitchMm: 70, rowStepMm: 70, halfDrop: false, clearSpaceMm: 10 }),
  preset("kit-dots", "small", "Small dots", "Fine dots, close together.", { dotWidthMm: 14, pitchMm: 30, rowStepMm: 15, halfDrop: true, clearSpaceMm: 10 }),
  preset("camo", "woodland", "Woodland camo", "Four greens and brown, medium blobs.", { scaleMm: 60, spread: 0.8, rough: 0.5, colourCount: 4 }, 7),
  preset("camo", "fine", "Fine camo", "Small, busy blobs.", { scaleMm: 30, spread: 1.2, rough: 0.6, colourCount: 4 }, 11),
  preset("camo", "bold", "Bold camo", "Large, calm blobs in three colours.", { scaleMm: 100, spread: 0.5, rough: 0.3, colourCount: 3 }, 3),
  preset("geometric", "chevrons", "Chevrons", "Rows of arrow points.", { motif: 0, sizeMm: 30, gapMm: 2 }),
  preset("geometric", "diamonds", "Diamonds", "A field of diamonds.", { motif: 1, sizeMm: 30, gapMm: 3 }),
  preset("geometric", "hexagons", "Honeycomb", "Hexagons side by side.", { motif: 3, sizeMm: 36, gapMm: 2 }),
  preset("gradient", "fade-down", "Fade to the hem", "The old fade: the colour runs out down the body.", { mode: 0, angleDeg: 90, lengthMm: 600, stops: 2 }),
  preset("gradient", "sunset", "Three-colour sunset", "Three colours, top to bottom, in steps.", { mode: 2, angleDeg: 90, lengthMm: 700, stops: 3, steps: 6 }),
  preset("gradient", "spotlight", "Spotlight", "A glow spreading from the chest.", { mode: 1, lengthMm: 500, stops: 2 }),
  preset("halftone", "fade-out", "Dots fading out", "Dots shrink down the body.", { pitchMm: 12, fullSize: 0.8, angleDeg: 90, lengthMm: 500, reverse: false }),
  preset("halftone", "fade-in", "Dots growing", "Dots grow down the body.", { pitchMm: 12, fullSize: 0.8, angleDeg: 90, lengthMm: 500, reverse: true }),
  preset("halftone", "across", "Dots across", "Dots shrink from side to side.", { pitchMm: 16, fullSize: 0.85, angleDeg: 0, lengthMm: 600, reverse: false }),
  preset("checks", "gingham", "Gingham", "Soft crossing bands.", { kind: 1, sizeMm: 20 }),
  preset("checks", "check", "Checkerboard", "Plain squares.", { kind: 0, sizeMm: 24 }),
  preset("checks", "houndstooth", "Houndstooth", "The broken check.", { kind: 2, sizeMm: 16 }),
  preset("brush", "sweeping", "Sweeping strokes", "Long strokes in one direction.", { lengthMm: 220, widthMm: 14, angleDeg: 30, angleSpread: 10, cover: 0.8 }, 5),
  preset("brush", "scribble", "Scribble", "Short strokes in all directions.", { lengthMm: 70, widthMm: 8, angleDeg: 90, angleSpread: 90, cover: 1.4 }, 9),
  preset("brush", "bold", "Bold paint", "Thick, wide strokes.", { lengthMm: 160, widthMm: 30, angleDeg: 150, angleSpread: 25, cover: 0.6 }, 2),
  preset("stripe-rhythm", "graduated", "Graduated stripes", "Stripes that grow wider in steps.", { rhythm: 1, widthMm: 20, gapMm: 20, growth: 0.25, angleDeg: 0 }),
  preset("stripe-rhythm", "double", "Double stripes", "Pairs of stripes.", { rhythm: 2, widthMm: 14, gapMm: 50, angleDeg: 0 }),
  preset("stripe-rhythm", "diagonal", "Irregular diagonal", "An uneven rhythm on the slant.", { rhythm: 3, widthMm: 24, gapMm: 30, angleDeg: 45 }, 4),
];

export const presetsOf = (generatorId: string): readonly GeneratorPreset[] => PRESETS.filter((entry) => entry.generatorId === generatorId);
