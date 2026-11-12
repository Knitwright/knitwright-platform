"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { busyProps, listProps } from "@/components/mockups/a11y";
import {
  APPLY_PALETTE,
  FONT_HEADING,
  FONT_LICENCE_GAP,
  FONT_NOT_APPLIED,
  NO_FONT,
  NO_PALETTE,
  NO_STYLE,
  NO_VOICE,
  OPEN_IMPORT,
  PALETTE_HEADING,
  STYLE_HEADING,
  VOICE_HEADING,
  brandIsEmpty,
  paletteApplied,
  type BrandPaletteRow,
  type BrandTabFont,
  type BrandView,
} from "@/lib/launch-panels";
import type { LaunchPanelProps, ProjectColour } from "@/lib/launch";
import { CARD, CHIP, INLINE_LINK, PanelEmpty, PanelGap, PanelLoading, PanelProblem, PanelShell } from "./frame";
import { useJson } from "./useJson";

/**
 * THE BRAND PANEL OF THE RAIL (spec Launch shell, "Brand", and F-S9; plan v5, decision 0108).
 *
 * L1's contract named workstream L7, which owned `lib/brand-studio/import/**` and no component
 * path, so this panel never existed either. It reads Y6's Brand Studio rows and applies a palette
 * **in one click**, through the one command the contract offers for it: `setProjectColours`. The
 * shell checks it, saves it and redraws, so the panel cannot put the project into a state a person
 * could not have reached by hand.
 *
 * **A type style the brand holds no licence for says so and is not offered.** Only the two bundled
 * Geist faces have a licence on file (Y6, decision 0079, where the database itself holds
 * `check (selectable = (licence = 'bundled'))`), and the licence note beside each row is word for
 * word what this repository can show. Setting type in one of them is the Text panel's own work, and
 * the panel says that rather than offering a button that would do nothing.
 */
export default function BrandPanel({ context, commands }: LaunchPanelProps) {
  const headingId = useId();
  const { state, reload } = useJson<BrandView>("/api/launch/brand");
  const [said, setSaid] = useState<string | null>(null);

  const apply = (palette: BrandPaletteRow) => {
    const colours: readonly ProjectColour[] = palette.colours.map((colour) => ({ hex: colour.hex, name: colour.name.trim() === "" ? colour.hex : colour.name }));
    commands.setProjectColours(colours);
    setSaid(paletteApplied(palette.name));
  };

  const view = state.kind === "ready" ? state.value : null;

  return (
    <PanelShell id="brand" headingId={headingId} busy={context.busy}>
      {state.kind === "loading" ? <PanelLoading id="brand" /> : null}
      {state.kind === "failed" ? <PanelProblem id="brand" onRetry={reload} /> : null}
      {view !== null && brandIsEmpty(view) ? <PanelEmpty id="brand" /> : null}

      {said === null ? null : (
        <p {...busyProps()} data-testid="launch-brand-said" className="rounded-xl border border-cobalt-soft/50 px-2.5 py-2 text-[12px] leading-relaxed text-ink">
          {said}
        </p>
      )}

      {view !== null && !brandIsEmpty(view) ? (
        <>
          <Group heading={PALETTE_HEADING} empty={view.palettes.length === 0 ? NO_PALETTE : null} testId="launch-brand-palettes">
            {view.palettes.map((palette) => (
              <Palette key={palette.id} palette={palette} busy={context.busy} onApply={() => apply(palette)} />
            ))}
          </Group>

          <Group heading={FONT_HEADING} empty={view.fonts.length === 0 ? NO_FONT : null} testId="launch-brand-fonts">
            {view.fonts.map((font) => (
              <Font key={font.key} font={font} />
            ))}
            {view.fonts.length === 0 ? null : <p className="text-[12px] leading-relaxed text-ink-2">{FONT_NOT_APPLIED}</p>}
          </Group>

          <Group heading={VOICE_HEADING} empty={view.voice.length === 0 ? NO_VOICE : null} testId="launch-brand-voice">
            <ul {...listProps("Your voice words")} className="flex flex-wrap gap-1.5">
              {view.voice.map((word) => (
                <li key={word} role="listitem" className="rounded-full border border-white/15 px-2.5 py-1 text-[12px] text-ink">
                  {word}
                </li>
              ))}
            </ul>
          </Group>

          <Group heading={STYLE_HEADING} empty={view.style.length === 0 ? NO_STYLE : null} testId="launch-brand-style">
            {view.style.map((text) => (
              <div key={text.label} className="flex flex-col gap-1">
                <h4 className="text-[12px] font-medium text-ink">{text.label}</h4>
                <p className="text-[12px] leading-relaxed text-ink-2">{text.text}</p>
              </div>
            ))}
          </Group>
        </>
      ) : null}

      <footer className="flex flex-col items-start gap-1.5 border-t border-white/10 pt-2">
        <p className="text-[12px] leading-relaxed text-ink-2">
          <Link href="/brand/import" className={INLINE_LINK} data-testid="launch-brand-import">
            {OPEN_IMPORT}
          </Link>
        </p>
        <PanelGap note={FONT_LICENCE_GAP} testId="launch-brand-font-gap" />
      </footer>
    </PanelShell>
  );
}

type GroupProps = Readonly<{ heading: string; empty: string | null; testId: string; children: ReactNode }>;

function Group({ heading, empty, testId, children }: GroupProps) {
  const headingId = `${testId}-heading`;
  return (
    <section aria-labelledby={headingId} data-testid={testId} className="flex min-w-0 flex-col gap-2">
      <h3 id={headingId} className="text-[13px] font-medium text-ink">
        {heading}
      </h3>
      {empty === null ? children : <p className="text-[13px] leading-relaxed text-ink-2">{empty}</p>}
    </section>
  );
}

type PaletteProps = Readonly<{ palette: BrandPaletteRow; busy: boolean; onApply: () => void }>;

export function Palette({ palette, busy, onApply }: PaletteProps) {
  return (
    <div className={CARD} data-testid={`launch-brand-palette-${palette.id}`}>
      <h4 className="text-[13px] font-medium text-ink">{palette.name}</h4>
      <ul {...listProps(`${palette.name} colours`)} className="flex flex-wrap gap-2">
        {palette.colours.map((colour) => (
          <li key={colour.key} role="listitem" className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-4 rounded-full border border-white/20" style={{ backgroundColor: colour.hex }} />
            <span className="text-[12px] text-ink">{colour.name.trim() === "" ? colour.hex : colour.name}</span>
          </li>
        ))}
      </ul>
      {palette.colours.some((colour) => !colour.inGamut) ? (
        <ul {...listProps(`What the estimate says about ${palette.name}`)} className="flex flex-col gap-1">
          {palette.colours
            .filter((colour) => colour.warning !== null)
            .map((colour) => (
              <li key={`${colour.key}-warning`} role="listitem" className="text-[12px] leading-relaxed text-ink-2">
                {colour.warning}
              </li>
            ))}
        </ul>
      ) : null}
      <button type="button" disabled={busy} onClick={onApply} className={CHIP} data-testid={`launch-brand-apply-${palette.id}`}>
        {APPLY_PALETTE}
        <span className="sr-only">: {palette.name}</span>
      </button>
    </div>
  );
}

export function Font({ font }: Readonly<{ font: BrandTabFont }>) {
  return (
    <div className={CARD} data-testid={`launch-brand-font-${font.key}`}>
      <h4 className="text-[13px] font-medium text-ink">
        {font.roleLabel === null ? font.label : `${font.roleLabel}: ${font.label}`}
      </h4>
      <p className="text-[12px] leading-relaxed text-ink-2">{font.licenceNote}</p>
    </div>
  );
}
