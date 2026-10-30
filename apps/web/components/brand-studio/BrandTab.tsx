"use client";

import { useId } from "react";

/**
 * THE SHARED BRAND TAB (spec F-S9: "a Brand tab in every colour and font picker").
 *
 * A STABLE, DOCUMENTED INTERFACE. Y3's Library toolbar, Y8's names and numbers and the wave 4
 * launch editor all drop this into their own colour and font pickers, so one component is the only
 * place that decides how a brand's colours and fonts are offered. Treat `BrandTabProps` as a
 * contract:
 *
 *   * It is PURELY PRESENTATIONAL. It fetches nothing, writes nothing and knows no route. The
 *     caller passes rows it has already read and gets a callback back. That is what makes it safe
 *     to use inside a popover, a drawer or a canvas inspector.
 *   * Every field is `readonly` and every list is `readonly`. Nothing is mutated.
 *   * Fields are only ever ADDED, and anything added is optional with a safe default. `subject`,
 *     `colours`, `fonts`, `selectedKey` and `onPick` will not change meaning.
 *   * A colour row carries BOTH `hex` and `safeHex` plus `inGamut`, because the sublimation
 *     estimate is worked out on the server (`lib/brand-studio/colours.ts`). This component never
 *     computes a colour and never states a print fact of its own.
 *   * A font row carries its `licence` and `licenceNote`, and a font that cannot be chosen is
 *     shown disabled with the note. The component never implies a font is licensed.
 *
 * Build the rows with `brandTabColours` and `brandTabFonts` in `lib/brand-studio/brand-tab.ts`,
 * which turn a `BrandRecord` into exactly these shapes.
 */

/** One brand colour, already worked out on the server. */
export type BrandTabColour = Readonly<{
  /** Unique within the tab. Pass the colour's own id. */
  key: string;
  name: string;
  /** The palette it belongs to, shown as a group heading. */
  paletteName: string;
  /** `#rrggbb` as the brand chose it. */
  hex: string;
  /** The nearest colour the sublimation estimate accepts. Equal to `hex` when it is already inside. */
  safeHex: string;
  inGamut: boolean;
  /** The brand's own Pantone TCX code, or null. Never worked out from the hex. */
  pantoneTcx: string | null;
  /** The sentence to show when `inGamut` is false. Says it is an estimate. */
  warning: string | null;
}>;

/** One font of the licensed kit-font list, for one role or for free choice. */
export type BrandTabFont = Readonly<{
  key: string;
  label: string;
  /** The role it is set for, such as "Headline", or null in a free font picker. */
  roleLabel: string | null;
  /** A CSS family to preview with, or null when no file is bundled. */
  family: string | null;
  licence: "bundled" | "not_established";
  /** Word for word, what the repository can show about the licence. */
  licenceNote: string;
  selectable: boolean;
}>;

export type BrandTabChoice =
  | Readonly<{ kind: "colour"; colour: BrandTabColour }>
  | Readonly<{ kind: "font"; font: BrandTabFont }>;

export interface BrandTabProps {
  /** Which picker this tab sits in. */
  readonly subject: "colour" | "font";
  /** Required when `subject` is "colour". Grouped by `paletteName`, in the order given. */
  readonly colours?: readonly BrandTabColour[];
  /** Required when `subject` is "font". */
  readonly fonts?: readonly BrandTabFont[];
  /** The `key` of the row shown as current, or null. */
  readonly selectedKey?: string | null;
  /** Called with the row the person chose. Left out, the tab is read only. */
  readonly onPick?: (choice: BrandTabChoice) => void;
  /** Where "Set up your brand" goes. Defaults to the brand page. */
  readonly manageHref?: string;
  /** Said when the brand has nothing of this kind yet. */
  readonly emptyMessage?: string;
  /** Shows the nearest sublimation-safe swatch beside each colour. On by default. */
  readonly showGamut?: boolean;
}

const CHIP = "rounded-full border border-hairline px-2 py-0.5 font-mono text-[11px] text-muted";
const ROW = "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors";

const groupsOf = (colours: readonly BrandTabColour[]): readonly (readonly [string, readonly BrandTabColour[]])[] => {
  const names = [...new Set(colours.map((colour) => colour.paletteName))];
  return names.map((name) => [name, colours.filter((colour) => colour.paletteName === name)] as const);
};

function ColourRow({ colour, current, showGamut, onPick }: Readonly<{ colour: BrandTabColour; current: boolean; showGamut: boolean; onPick?: () => void }>) {
  return (
    <li>
      <button
        type="button"
        disabled={onPick === undefined}
        aria-current={current ? "true" : undefined}
        onClick={onPick}
        className={`${ROW} ${current ? "border-cobalt-soft bg-white/[0.08]" : "border-hairline hover:border-white/25"} disabled:cursor-default`}
      >
        <span aria-hidden="true" className="size-7 shrink-0 rounded-lg border border-white/15" style={{ backgroundColor: colour.hex }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ink">{colour.name === "" ? colour.hex : colour.name}</span>
          <span className="block truncate font-mono text-[11px] text-muted">
            {colour.hex}
            {colour.pantoneTcx === null ? " · no Pantone TCX code yet" : ` · ${colour.pantoneTcx}`}
          </span>
        </span>
        {showGamut && !colour.inGamut ? (
          <span className="flex shrink-0 items-center gap-1.5" title={colour.warning ?? undefined}>
            <span aria-hidden="true" className="size-5 rounded-md border border-white/15" style={{ backgroundColor: colour.safeHex }} />
            <span className="text-[11px] text-warn">may print duller</span>
          </span>
        ) : null}
      </button>
    </li>
  );
}

function FontRow({ font, current, onPick }: Readonly<{ font: BrandTabFont; current: boolean; onPick?: () => void }>) {
  const usable = font.selectable && onPick !== undefined;
  return (
    <li>
      <button
        type="button"
        disabled={!usable}
        aria-current={current ? "true" : undefined}
        aria-describedby={font.selectable ? undefined : `${font.key}-licence`}
        onClick={usable ? onPick : undefined}
        className={`${ROW} ${current ? "border-cobalt-soft bg-white/[0.08]" : "border-hairline hover:border-white/25"} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ink" style={font.family === null ? undefined : { fontFamily: font.family }}>
            {font.label}
          </span>
          {font.roleLabel === null ? null : <span className="block text-[11px] text-muted">{font.roleLabel}</span>}
        </span>
        {font.selectable ? null : <span className={CHIP}>no licence on file</span>}
      </button>
      {font.selectable ? null : (
        <p id={`${font.key}-licence`} className="px-3 pb-1 pt-1 text-[11px] leading-relaxed text-muted">
          {font.licenceNote}
        </p>
      )}
    </li>
  );
}

/** The Brand tab of a colour or font picker. See the contract at the top of this file. */
export function BrandTab({
  subject,
  colours = [],
  fonts = [],
  selectedKey = null,
  onPick,
  manageHref = "/brand-studio",
  emptyMessage,
  showGamut = true,
}: BrandTabProps) {
  const headingId = useId();
  const rows = subject === "colour" ? colours.length : fonts.length;
  const empty = emptyMessage ?? (subject === "colour" ? "This brand has no palette yet." : "This brand has no font set yet.");

  if (rows === 0) {
    return (
      <div aria-labelledby={headingId} className="flex flex-col gap-2 p-1">
        <p id={headingId} className="text-sm text-muted">
          {empty}
        </p>
        <a href={manageHref} className="soft-link text-sm text-cobalt-soft">
          Set up your brand
        </a>
      </div>
    );
  }

  return (
    <div aria-labelledby={headingId} className="flex flex-col gap-3 p-1">
      <p id={headingId} className="sr-only">
        {subject === "colour" ? "Your brand's colours" : "Your brand's fonts"}
      </p>
      {subject === "colour" ? (
        groupsOf(colours).map(([name, group]) => (
          <div key={name} className="flex flex-col gap-1.5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted">{name}</p>
            <ul className="flex flex-col gap-1.5">
              {group.map((colour) => (
                <ColourRow
                  key={colour.key}
                  colour={colour}
                  current={colour.key === selectedKey}
                  showGamut={showGamut}
                  onPick={onPick === undefined ? undefined : () => onPick({ kind: "colour", colour })}
                />
              ))}
            </ul>
          </div>
        ))
      ) : (
        <ul className="flex flex-col gap-1.5">
          {fonts.map((font) => (
            <FontRow
              key={font.key}
              font={font}
              current={font.key === selectedKey}
              onPick={onPick === undefined ? undefined : () => onPick({ kind: "font", font })}
            />
          ))}
        </ul>
      )}
      <a href={manageHref} className="soft-link text-[13px] text-cobalt-soft">
        Manage brand
      </a>
    </div>
  );
}
