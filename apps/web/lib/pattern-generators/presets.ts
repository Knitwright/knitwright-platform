/**
 * Three named presets for each style: a starting point a club can pick, then tweak. A preset is settings and a seed,
 * never a picture. (`lib/kit-styles/presets.ts` is the older list of whole kit looks, and is only read.)
 */

export interface GeneratorPreset {
  readonly id: string;
  readonly generatorId: string;
  readonly label: string;
  readonly params: Readonly<Record<string, number | boolean>>;
  readonly seed: number;
  /** How many colours the preset looks right in. */
  readonly colours: number;
}

const preset = (generatorId: string, id: string, label: string, params: Record<string, number | boolean>, colours: number, seed = 7): GeneratorPreset => ({
  id: `${generatorId}-${id}`,
  generatorId,
  label,
  params,
  seed,
  colours,
});

const band = (generatorId: string, wide: number, middle: number, narrow: number): GeneratorPreset[] => [
  preset(generatorId, "wide", "Wide", { bandWidthMm: wide }, 2),
  preset(generatorId, "classic", "Classic", { bandWidthMm: middle }, 2),
  preset(generatorId, "narrow", "Narrow", { bandWidthMm: narrow }, 2),
];

export const PRESETS: readonly GeneratorPreset[] = [
  ...band("kit-hoops", 120, 90, 45),
  ...band("kit-stripes", 100, 70, 40),
  ...band("kit-pinstripes", 60, 32, 16),
  ...band("kit-sash", 150, 110, 70),
  ...band("kit-side-panels", 110, 80, 50),
  ...band("kit-chest-band", 130, 90, 55),
  preset("kit-fade", "plain", "Plain fade", {}, 2),
  preset("kit-fade", "second", "Second look", {}, 2, 8),
  preset("kit-fade", "third", "Third look", {}, 2, 9),
  preset("kit-dots", "benchmark", "Benchmark dots", { dotWidthMm: 30, pitchMm: 70, rowStepMm: 35, halfDrop: true, clearSpaceMm: 10 }, 2),
  preset("kit-dots", "large", "Large dots", { dotWidthMm: 50, pitchMm: 110, rowStepMm: 55, halfDrop: true, clearSpaceMm: 10 }, 2),
  preset("kit-dots", "small", "Small dots", { dotWidthMm: 18, pitchMm: 40, rowStepMm: 20, halfDrop: true, clearSpaceMm: 10 }, 2),
  preset("camo", "woodland", "Woodland", { scale: 60, spread: 0.6, roughness: 0.3 }, 4),
  preset("camo", "big-blocks", "Big blocks", { scale: 110, spread: 0.8, roughness: 0.1 }, 3),
  preset("camo", "fine-speckle", "Fine speckle", { scale: 32, spread: 0.5, roughness: 0.5 }, 5),
  preset("geometric", "chevrons", "Chevrons", { motif: 0, size: 40, gap: 0.08 }, 2),
  preset("geometric", "diamonds", "Diamonds", { motif: 1, size: 50, gap: 0.04 }, 2),
  preset("geometric", "hexagons", "Hexagons", { motif: 3, size: 45, gap: 0.12 }, 2),
  preset("gradient", "fade", "Fade into the second colour", { mode: 0, angle: 90, length: 600, steps: 32 }, 2),
  preset("gradient", "round", "Round glow", { mode: 1, angle: 0, length: 500, steps: 24 }, 3),
  preset("gradient", "stepped", "Stepped bands", { mode: 2, angle: 90, length: 700, steps: 8 }, 4),
  preset("halftone", "fade-down", "Dots fading down", { pitch: 12, rampLength: 700, angle: 90, maxDot: 0.9, minDot: 0.05 }, 1),
  preset("halftone", "bold", "Bold dots", { pitch: 20, rampLength: 900, angle: 90, maxDot: 1, minDot: 0.2 }, 1),
  preset("halftone", "diagonal", "Diagonal fade", { pitch: 10, rampLength: 800, angle: 45, maxDot: 0.8, minDot: 0 }, 1),
  preset("checks", "classic", "Classic checks", { size: 40, ratio: 1 }, 2),
  preset("checks", "small", "Small checks", { size: 16, ratio: 1 }, 2),
  preset("checks", "tall", "Tall checks", { size: 40, ratio: 1.5 }, 2),
  preset("gingham", "classic", "Classic gingham", { size: 20, contrast: 0.35 }, 1),
  preset("gingham", "large", "Large gingham", { size: 40, contrast: 0.4 }, 1),
  preset("gingham", "soft", "Soft gingham", { size: 12, contrast: 0.15 }, 1),
  preset("houndstooth", "classic", "Classic houndstooth", { size: 48 }, 1),
  preset("houndstooth", "large", "Large houndstooth", { size: 96 }, 2),
  preset("houndstooth", "small", "Small houndstooth", { size: 28 }, 1),
  preset("brush", "loose", "Loose strokes", { length: 100, width: 10, angle: 35, angleSpread: 20, coverage: 0.5 }, 3),
  preset("brush", "bold", "Bold strokes", { length: 200, width: 24, angle: 20, angleSpread: 15, coverage: 0.6 }, 2),
  preset("brush", "scratchy", "Scratchy", { length: 60, width: 4, angle: 60, angleSpread: 70, coverage: 0.9 }, 2),
  preset("stripe-variations", "graduated", "Graduated stripes", { rhythm: 1, width: 24, angle: 90, grow: 0.5 }, 2),
  preset("stripe-variations", "double", "Double stripes", { rhythm: 2, width: 40, angle: 90, grow: 0.5 }, 1),
  preset("stripe-variations", "diagonal", "Diagonal stripes", { rhythm: 0, width: 30, angle: 45, grow: 0.5 }, 2),
];

export const presetsFor = (generatorId: string): readonly GeneratorPreset[] => PRESETS.filter((entry) => entry.generatorId === generatorId);

export const getPreset = (id: string): GeneratorPreset | undefined => PRESETS.find((entry) => entry.id === id);
