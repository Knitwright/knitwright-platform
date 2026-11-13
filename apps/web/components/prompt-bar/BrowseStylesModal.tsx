"use client";

import { CloudUpload } from "lucide-react";
import { useState } from "react";
import { ToneArt } from "@/components/ai-studio/art";
import { Icon } from "@/components/ui/Icon";
import { SearchInput, Toggle } from "@/components/ui/Inputs";
import { cx } from "@/components/ui/cx";
import { TONES } from "@/lib/ai-studio/catalogue";
import { STYLE_CHOICES, type ShootStyle } from "@/lib/prompt-bar";
import { SplitModal } from "./SplitModal";

/**
 * + menu → Browse Styles (decision 0149; `08` v3.3, prototype e38). The styles are the AI image
 * board's own five (`lib/shoots` `SHOOT_STYLES`); picking one sets the bar's style, which the run
 * sends as that style's light and camera words. Each card says the model it runs on, which is the
 * platform's one picture model.
 *
 * Two of Kittl's controls are shown as they truly are here: **Upload Style** is not offered (a
 * brand's own styles are not kept anywhere yet), and **Auto-apply Model** is on and fixed, because
 * there is only one picture model to apply.
 */

type Props = Readonly<{ open: boolean; onClose: () => void; style: ShootStyle; onPick: (style: ShootStyle) => void; modelLabel: string }>;

export function BrowseStylesModal({ open, onClose, style, onPick, modelLabel }: Props) {
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase();
  const shown = STYLE_CHOICES.filter((one) => one.label.toLowerCase().includes(words));

  const left = (
    <div className="flex flex-1 flex-col gap-4">
      <nav aria-label="Style categories" className="flex flex-col gap-1">
        <span aria-current="true" className="rounded-md bg-soft px-4 py-2.5 text-title text-text">
          Featured
        </span>
      </nav>
      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
        <button
          type="button"
          disabled
          title="Your own styles are not kept anywhere yet, so there is nothing to upload to."
          className="flex items-center gap-2 rounded-md px-2 py-2 text-body-lg font-medium text-text-2 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <Icon icon={CloudUpload} size={20} />
          Upload Style
        </button>
        <div className="flex flex-col gap-1 rounded-xl bg-soft p-3.5">
          <Toggle checked onChange={() => undefined} disabled label="Auto-apply Model" />
          <p className="text-small text-muted">This platform runs one picture model, so every style uses it.</p>
        </div>
      </div>
    </div>
  );

  return (
    <SplitModal open={open} onClose={onClose} title="Browse Styles" left={left} testId="browse-styles">
      <SearchInput aria-label="Search styles" placeholder="Search styles" value={query} onChange={(event) => setQuery(event.target.value)} />
      {shown.length === 0 ? (
        <p className="text-body text-muted">No style matches “{query.trim()}”.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((one, index) => (
            <li key={one.value}>
              <button
                type="button"
                aria-pressed={one.value === style}
                onClick={() => {
                  onPick(one.value);
                  onClose();
                }}
                className="group flex w-full flex-col gap-1.5 text-left"
                data-style={one.value}
              >
                <ToneArt tone={TONES[index % TONES.length]!} className={cx("rounded-xl ring-electric ring-offset-2 group-focus-visible:ring-2", one.value === style && "ring-2")} />
                <span className="text-body-lg font-medium text-text">{one.label}</span>
                <span className="text-body text-muted">{modelLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SplitModal>
  );
}
