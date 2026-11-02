"use client";

import { Notice } from "@/components/ui/Notice";
import type { SwatchView } from "@/lib/crest-to-kit/view";
import { PALETTE_EMPTY, PALETTE_TITLE } from "@/lib/crest-to-kit/words";

/**
 * The colours read from a crest (spec F-T2 step 2), each with the colour a sublimation print is
 * estimated to reach and the nearest colour Knitwright can name.
 *
 * Where the estimate had to move a colour the row SAYS SO and shows both, rather than quietly
 * printing the one the club would actually receive. Nothing here claims a Pantone number: the
 * basis lines under the strip say plainly that Knitwright holds none.
 */

export type PaletteStripProps = Readonly<{ palette: readonly SwatchView[]; basis: readonly string[] }>;

const Chip = ({ hex, label }: Readonly<{ hex: string; label: string }>) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-2.5 py-1 text-[13px] text-ink-2">
    <span aria-hidden="true" className="size-3.5 rounded-full border border-white/30" style={{ backgroundColor: hex }} />
    {label}
  </span>
);

export function PaletteStrip({ palette, basis }: PaletteStripProps) {
  if (palette.length === 0) {
    return (
      <p className="text-sm text-muted" data-testid="crest-to-kit-palette-empty">
        {PALETTE_EMPTY}
      </p>
    );
  }
  return (
    <section aria-labelledby="crest-palette" className="flex flex-col gap-3" data-testid="crest-to-kit-palette">
      <h2 id="crest-palette" className="text-base font-semibold text-ink">
        {PALETTE_TITLE}
      </h2>
      <ul className="flex flex-col gap-3">
        {palette.map((swatch) => (
          <li key={swatch.hex} className="flex flex-col gap-1.5 rounded-2xl border border-hairline bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Chip hex={swatch.hex} label={swatch.hex} />
              <span className="text-[13px] text-muted">{swatch.share} of your crest</span>
              {swatch.name === null ? null : <span className="text-[13px] text-muted">nearest named colour: {swatch.name}</span>}
            </div>
            {swatch.inGamut ? (
              <p className="text-[13px] text-muted">A sublimation print is estimated to reach this colour as it is.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip hex={swatch.safeHex} label={`printed: ${swatch.safeHex}`} />
                  <span className="text-[13px] text-warn">ΔE00 {swatch.delta}</span>
                </div>
                {swatch.warning === null ? null : <p className="text-[13px] leading-relaxed text-warn">{swatch.warning}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>
      <Notice>
        {basis.map((line) => (
          <p key={line} className="mt-1 first:mt-0">
            {line}
          </p>
        ))}
      </Notice>
    </section>
  );
}
