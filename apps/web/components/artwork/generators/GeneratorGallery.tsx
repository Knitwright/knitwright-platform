"use client";

import type { PatternGenerator } from "@/lib/artwork-stack/generator";
import type { GeneratorPreset } from "@/lib/pattern-generators/presets";
import { previewOf, SWATCH_MM } from "./preview";

type GalleryProps = Readonly<{
  generators: readonly PatternGenerator[];
  presets: readonly GeneratorPreset[];
  /** The pattern's colours as screen colours, main first. A stand-in set is drawn when left out. */
  colours?: readonly string[];
  /** The preset that is on the design now. */
  chosenId?: string;
  onPick: (preset: GeneratorPreset) => void;
}>;

function Swatch({ generator, preset, colours }: Readonly<{ generator: PatternGenerator; preset: GeneratorPreset; colours?: readonly string[] }>) {
  const drawn = previewOf(generator, preset, colours);
  return (
    <svg viewBox={`0 0 ${SWATCH_MM} ${SWATCH_MM}`} role="img" aria-label={`${preset.label}: ${preset.hint}`} className="aspect-square w-full rounded-md border border-hairline">
      <rect width={SWATCH_MM} height={SWATCH_MM} fill={drawn.ground} />
      {drawn.shapes.map((shape) =>
        shape.tag === "circle" ? (
          <circle key={shape.key} cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} />
        ) : (
          <polygon key={shape.key} points={shape.points} fill={shape.fill} />
        ),
      )}
    </svg>
  );
}

/** Every pattern style with its named starting points, each drawn small. Picking one is a single change. */
export function GeneratorGallery({ generators, presets, colours, chosenId, onPick }: GalleryProps) {
  return (
    <div className="flex flex-col gap-6">
      {generators.map((generator) => {
        const own = presets.filter((preset) => preset.generatorId === generator.id);
        if (own.length === 0) return null;
        return (
          <section key={generator.id} aria-labelledby={`gen-${generator.id}`} className="flex flex-col gap-2">
            <h3 id={`gen-${generator.id}`} className="text-sm font-medium text-ink">
              {generator.label}
            </h3>
            <ul className="grid grid-cols-3 gap-3">
              {own.map((preset) => (
                <li key={preset.id}>
                  <button
                    type="button"
                    onClick={() => onPick(preset)}
                    aria-pressed={chosenId === preset.id}
                    className="flex w-full flex-col gap-1 rounded-md p-1 text-left text-sm text-ink-2 aria-pressed:bg-cobalt-wash focus-visible:outline-2 focus-visible:outline-cobalt-soft"
                  >
                    <Swatch generator={generator} preset={preset} colours={colours} />
                    {preset.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
