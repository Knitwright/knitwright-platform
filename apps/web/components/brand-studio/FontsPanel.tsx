"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { saveBrandFontsAction } from "@/lib/brand-studio/actions";
import type { FontChoice, KitFont } from "@/lib/brand-studio/types";
import { FONT_ROLES, FONT_ROLE_LABELS, type FontRole } from "@/lib/brand-studio/words";

type Props = Readonly<{ fonts: readonly FontChoice[]; kitFonts: readonly KitFont[]; canEdit: boolean }>;

/**
 * The Fonts tab of F-S9: one font per role, from the licensed kit-font list.
 *
 * A FONT IS OFFERED ONLY WHEN ITS LICENCE IS ON FILE. The list comes from
 * `public.brand_studio_fonts`, whose own check constraint allows `selectable` only for a licence the
 * repository can show. Everything else is a labelled placeholder, shown disabled with its note, so
 * nothing here implies a licence nobody has.
 */
export function FontsPanel({ fonts, kitFonts, canEdit }: Props) {
  const [chosen, setChosen] = useState<Readonly<Record<string, string>>>(
    Object.fromEntries(fonts.flatMap((font) => (font.fontKey === null ? [] : [[font.role, font.fontKey]]))),
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);
  const placeholders = kitFonts.filter((font) => !font.selectable);

  const save = async () => {
    setBusy(true);
    const reply = await saveBrandFontsAction({
      fonts: FONT_ROLES.map((role) => ({ role, fontKey: chosen[role] ?? null })),
    });
    setBusy(false);
    setNote(reply.success ? { tone: "ok", text: "Your fonts are saved." } : { tone: "warn", text: reply.error.message });
  };

  const familyOf = (role: FontRole): string | undefined => {
    const font = kitFonts.find((entry) => entry.key === chosen[role]);
    return font === undefined || font.family === "" ? undefined : font.family;
  };

  return (
    <div className="flex flex-col gap-5">
      {FONT_ROLES.map((role) => (
        <label key={role} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">{FONT_ROLE_LABELS[role]}</span>
          <select
            className={FIELD_CONTROL}
            aria-label={`${FONT_ROLE_LABELS[role]} font`}
            disabled={!canEdit}
            value={chosen[role] ?? ""}
            onChange={(event) => setChosen({ ...chosen, [role]: event.target.value })}
          >
            <option value="">Not chosen</option>
            {kitFonts.map((font) => (
              <option key={font.key} value={font.key} disabled={!font.selectable}>
                {font.selectable ? font.label : `${font.label} — no licence on file`}
              </option>
            ))}
          </select>
          <span className="text-[15px] text-ink-2" style={familyOf(role) === undefined ? undefined : { fontFamily: familyOf(role) }}>
            {role === "name_number" ? "SMITH 7" : "The quick brown fox"}
          </span>
        </label>
      ))}

      {canEdit ? (
        <div>
          <Button type="button" pending={busy} onClick={() => void save()}>
            Save fonts
          </Button>
        </div>
      ) : (
        <Notice>Your role can look at the brand but not change it.</Notice>
      )}

      {placeholders.length === 0 ? null : (
        <section aria-label="Fonts we cannot offer yet" className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Fonts we cannot offer yet</p>
          <ul className="flex flex-col gap-1.5">
            {placeholders.map((font) => (
              <li key={font.key} className="text-[13px] leading-relaxed text-muted">
                <span className="text-ink">{font.label}:</span> {font.licenceNote}
              </li>
            ))}
          </ul>
        </section>
      )}

      {note ? (
        <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
          {note.text}
        </Notice>
      ) : null}
    </div>
  );
}
