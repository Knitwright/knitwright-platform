"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { crestPaletteAction, deleteBrandPaletteAction, saveBrandPaletteAction } from "@/lib/brand-studio/actions";
import { CLUB_KIT_NOTE } from "@/lib/brand-studio/club-kit";
import type { ArtworkFacts, BrandPalette } from "@/lib/brand-studio/types";
import { LIMITS } from "@/lib/brand-studio/words";
import { nearestSublimationSafe } from "@/lib/colour/palette";

type Draft = Readonly<{ name: string; hex: string; pantoneTcx: string }>;
type Props = Readonly<{ palettes: readonly BrandPalette[]; uploads: readonly ArtworkFacts[]; canEdit: boolean }>;

const EMPTY: Draft = { name: "", hex: "#0b3d91", pantoneTcx: "" };

/** One colour row with the sublimation estimate worked out as the person types. */
function ColourRow({ colour, disabled, onChange, onRemove }: Readonly<{ colour: Draft; disabled: boolean; onChange: (next: Draft) => void; onRemove?: () => void }>) {
  const match = nearestSublimationSafe(/^#[0-9a-fA-F]{6}$/.test(colour.hex) ? colour.hex : "#000000");
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-hairline px-3 py-3">
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
        <input
          type="color"
          aria-label="Colour"
          disabled={disabled}
          value={colour.hex}
          onChange={(event) => onChange({ ...colour, hex: event.target.value })}
          className="size-11 shrink-0 cursor-pointer rounded-xl border border-hairline bg-transparent p-1 disabled:cursor-not-allowed"
        />
        <input
          className={FIELD_CONTROL}
          placeholder="Name, such as Club red"
          maxLength={LIMITS.colourName}
          disabled={disabled}
          value={colour.name}
          onChange={(event) => onChange({ ...colour, name: event.target.value })}
        />
        <input
          className={FIELD_CONTROL}
          placeholder="Pantone TCX, as printed in your book"
          maxLength={LIMITS.pantone}
          disabled={disabled}
          value={colour.pantoneTcx}
          onChange={(event) => onChange({ ...colour, pantoneTcx: event.target.value })}
        />
        {onRemove ? (
          <Button variant="quiet" type="button" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>
      <p className="font-mono text-[11px] text-muted">
        {match.hex}
        {colour.pantoneTcx.trim() === "" ? " · no Pantone TCX code yet" : ` · ${colour.pantoneTcx.trim()}`}
      </p>
      {match.inGamut ? null : (
        <p className="flex items-start gap-2 text-[13px] text-warn" data-testid="gamut-warning">
          <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 rounded border border-white/20" style={{ backgroundColor: match.safeHex }} />
          <span>
            {match.warning} <span className="font-mono text-[11px] text-faint">R-GAP-000 · no rulebook entry for this yet</span>
          </span>
        </p>
      )}
    </li>
  );
}

function PaletteEditor({ palette, uploads, canEdit }: Readonly<{ palette: BrandPalette | null; uploads: readonly ArtworkFacts[]; canEdit: boolean }>) {
  const [name, setName] = useState(palette?.name ?? "");
  const [colours, setColours] = useState<readonly Draft[]>(
    palette === null ? [EMPTY] : palette.colours.map((colour) => ({ name: colour.name, hex: colour.hex, pantoneTcx: colour.pantoneTcx ?? "" })),
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);

  const say = (tone: "ok" | "warn", text: string) => setNote({ tone, text });

  const save = async () => {
    setBusy(true);
    const reply = await saveBrandPaletteAction({
      paletteId: palette?.id ?? null,
      name,
      colours: colours.map((colour) => ({ name: colour.name, hex: colour.hex, pantoneTcx: colour.pantoneTcx })),
    });
    setBusy(false);
    say(reply.success ? "ok" : "warn", reply.success ? "The palette is saved." : reply.error.message);
  };

  const remove = async () => {
    if (palette === null) return;
    setBusy(true);
    const reply = await deleteBrandPaletteAction({ paletteId: palette.id });
    setBusy(false);
    say(reply.success ? "ok" : "warn", reply.success ? "The palette is gone." : reply.error.message);
  };

  const fromCrest = async (artworkId: string) => {
    setBusy(true);
    const reply = await crestPaletteAction({ artworkId });
    setBusy(false);
    if (!reply.success) return say("warn", reply.error.message);
    if (reply.data.swatches.length === 0) return say("warn", "That upload has no colours we could read.");
    setColours(reply.data.swatches.map((swatch, at) => ({ name: at === 0 ? "Main colour" : `Colour ${at + 1}`, hex: swatch.hex, pantoneTcx: "" })));
    return say("ok", "Read from your crest. Check each colour, then save.");
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        className={FIELD_CONTROL}
        placeholder="Palette name, such as Primary or Kit colours"
        maxLength={LIMITS.paletteName}
        disabled={!canEdit}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <ul className="flex flex-col gap-2">
        {colours.map((colour, at) => (
          <ColourRow
            key={at}
            colour={colour}
            disabled={!canEdit}
            onChange={(next) => setColours(colours.map((other, index) => (index === at ? next : other)))}
            onRemove={canEdit && colours.length > 1 ? () => setColours(colours.filter((_, index) => index !== at)) : undefined}
          />
        ))}
      </ul>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          {colours.length < LIMITS.coloursPerPalette ? (
            <Button variant="secondary" type="button" onClick={() => setColours([...colours, EMPTY])}>
              Add a colour
            </Button>
          ) : null}
          <Button type="button" pending={busy} onClick={() => void save()}>
            Save palette
          </Button>
          {palette === null ? null : (
            <Button variant="quiet" type="button" onClick={() => void remove()}>
              Delete palette
            </Button>
          )}
        </div>
      ) : null}
      {canEdit && uploads.length > 0 ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Start from your crest</span>
          <select className={FIELD_CONTROL} defaultValue="" onChange={(event) => event.target.value !== "" && void fromCrest(event.target.value)}>
            <option value="">Choose one of your uploads</option>
            {uploads.map((upload) => (
              <option key={upload.artworkId} value={upload.artworkId}>
                {upload.label}
              </option>
            ))}
          </select>
          <span className="text-[13px] text-muted">
            We read the colours and fill the rows in. Nothing is saved until you press Save palette.
          </span>
        </label>
      ) : null}
      {note ? (
        <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
          {note.text}
        </Notice>
      ) : null}
    </div>
  );
}

/** The Colours tab of F-S9: named palettes, each colour with hex, Pantone TCX and the gamut estimate. */
export function ColoursPanel({ palettes, uploads, canEdit }: Props) {
  const own = palettes.filter((palette) => palette.source === "brand-studio");
  const readThrough = palettes.filter((palette) => palette.source === "club-kit");
  const [adding, setAdding] = useState(own.length === 0);

  return (
    <div className="flex flex-col gap-6">
      {own.map((palette) => (
        <section key={palette.id} aria-label={palette.name} className="rounded-2xl border border-hairline bg-white/[0.03] p-4">
          <PaletteEditor palette={palette} uploads={uploads} canEdit={canEdit} />
        </section>
      ))}

      {readThrough.map((palette) => (
        <section key={palette.id} aria-label={palette.name} className="rounded-2xl border border-hairline bg-white/[0.03] p-4">
          <p className="text-[15px] text-ink">{palette.name}</p>
          <p className="mt-1 text-[13px] text-muted">{CLUB_KIT_NOTE}</p>
          <ul className="mt-3 flex flex-wrap gap-3">
            {palette.colours.map((colour) => {
              const match = nearestSublimationSafe(colour.hex);
              return (
                <li key={colour.id} className="flex items-center gap-2 text-[13px] text-muted">
                  <span aria-hidden="true" className="size-7 rounded-lg border border-white/15" style={{ backgroundColor: colour.hex }} />
                  <span>
                    {colour.name}
                    <span className="block font-mono text-[11px]">
                      {colour.hex}
                      {match.inGamut ? "" : " · may print duller"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {canEdit && own.length < LIMITS.palettesPerBrand ? (
        adding ? (
          <section aria-label="New palette" className="rounded-2xl border border-cobalt-soft/30 bg-cobalt-wash p-4">
            <PaletteEditor palette={null} uploads={uploads} canEdit={canEdit} />
          </section>
        ) : (
          <div>
            <Button variant="secondary" type="button" onClick={() => setAdding(true)}>
              Add a palette
            </Button>
          </div>
        )
      ) : null}

      {canEdit ? null : <Notice>Your role can look at the brand but not change it.</Notice>}
    </div>
  );
}
