"use client";

import { CloudUpload, X } from "lucide-react";
import { useState } from "react";
import { FilterChip } from "@/components/ui/Chips";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { SearchInput } from "@/components/ui/Inputs";
import { PremiumMark } from "@/components/ui/Marks";
import { Tabs, tabPanelProps } from "@/components/ui/Tabs";
import { ALL_FONTS, chipsFor, filterFonts, unpickableReason, type FontRow } from "@/lib/pickers";

/**
 * THE FONT PICKER (plan v6 E5, decision 0149; `08` v3.7 "Font picker", §5.7 "Font panel", prototype
 * e32): opened from the font name in the text panel. **Fonts | Brand** tabs and ✕, a search field,
 * filter chips, then the list, each font drawn in its own face, with a KIT-SAFE tag where the list
 * says so; **Upload font** ♛ at the foot.
 *
 * Fonts is the platform's licensed kit-font list; Brand is the fonts the brand chose for each role
 * (Brand Studio's `kitFontRows` and `brandTabFonts`). A font with no licence on file is listed with
 * its licence note and cannot be picked. Exported for E3's text inspector: `onPick` gets the row.
 */

export type FontPickerProps = Readonly<{
  /** The key of the font in use, or null. */
  value: string | null;
  onPick: (font: FontRow) => void;
  onClose?: () => void;
  fonts: readonly FontRow[];
  brand: readonly FontRow[];
}>;

const ID = "font-picker";
const TABS = [
  { id: "fonts", label: "Fonts" },
  { id: "brand", label: "Brand" },
];

export function FontPicker({ value, onPick, onClose, fonts, brand }: FontPickerProps) {
  const [tab, setTab] = useState<"fonts" | "brand">("fonts");
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState(ALL_FONTS);
  const rows = tab === "fonts" ? fonts : brand;
  const chips = chipsFor(rows);
  const shown = filterFonts(rows, chips.some((one) => one.id === chip) ? chip : ALL_FONTS, query);

  return (
    <section aria-label="Fonts" className="flex max-h-185 w-80 max-w-full flex-col gap-3 rounded-2xl border border-border bg-bg p-4 text-text shadow-e3" data-testid="font-picker">
      <div className="flex items-center justify-between border-b border-border">
        <Tabs items={TABS} value={tab} onChange={(id) => setTab(id as typeof tab)} label="Font source" idBase={ID} className="border-b-0" />
        {onClose ? (
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-full live:hover:bg-soft">
            <Icon icon={X} size={20} />
          </button>
        ) : null}
      </div>
      <SearchInput aria-label="Search fonts" placeholder="Search fonts" value={query} onChange={(event) => setQuery(event.target.value)} />
      {chips.length > 1 ? (
        <div role="group" aria-label="Filter fonts" className="flex gap-2 overflow-x-auto pb-1">
          {chips.map((one) => (
            <FilterChip key={one.id} label={one.label} selected={one.id === chip} onClick={() => setChip(one.id)} />
          ))}
        </div>
      ) : null}
      <div {...tabPanelProps(ID, tab)} className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="py-4 text-body text-muted">
            {rows.length === 0 ? (tab === "brand" ? "Your brand has no fonts set yet. Choose them on the Brand page and they appear here." : "No fonts are on the list yet.") : `No font matches “${query.trim()}”.`}
          </p>
        ) : (
          <ul aria-label={tab === "fonts" ? "Fonts" : "Brand fonts"} className="flex flex-col">
            {shown.map((row) => {
              const why = unpickableReason(row);
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    disabled={why !== null}
                    aria-pressed={row.key === value}
                    title={why ?? undefined}
                    onClick={() => onPick(row)}
                    className={cx("flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-fast live:hover:bg-soft disabled:cursor-not-allowed", row.key === value && "bg-soft")}
                    data-font={row.key}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cx("truncate text-h2", why !== null && "text-muted-2")} style={row.family ? { fontFamily: row.family } : undefined}>
                        {row.label}
                      </span>
                      {row.roleLabel ? <span className="text-small text-muted">{row.roleLabel}</span> : null}
                      {why !== null ? <span className="line-clamp-2 text-caption text-muted">{why}</span> : null}
                    </span>
                    {row.kitSafe ? <span className="shrink-0 rounded-xs bg-ok-soft px-1.5 py-0.5 text-micro text-ok">KIT-SAFE</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <button
        type="button"
        disabled
        title="Uploading a font is not available yet: only fonts whose licence is on file can be used."
        className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border text-body-lg font-semibold text-text disabled:cursor-not-allowed disabled:opacity-55"
      >
        <Icon icon={CloudUpload} size={20} />
        Upload font
        <PremiumMark />
      </button>
    </section>
  );
}
