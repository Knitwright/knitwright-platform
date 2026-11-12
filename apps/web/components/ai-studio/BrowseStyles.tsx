"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { Select, SearchInput, Toggle } from "@/components/ui/Inputs";
import { Modal } from "@/components/ui/Modal";
import type { Option } from "@/lib/ai-studio/forms";
import { TONES } from "@/lib/ai-studio/catalogue";
import { ToneArt } from "./art";

/**
 * The Browse styles drawer (`09` screen 3): Featured ▾, a search, the style tiles and Auto-apply
 * model. A style is one of the shoots' own image styles (`lib/shoots`), and a tile opens the Image
 * generator with it chosen; with Auto-apply on, the generator also starts with a model preset.
 */

type Props = Readonly<{ open: boolean; onClose: () => void; styles: readonly Option[] }>;

const ORDERS = [
  { value: "featured", label: "Featured" },
  { value: "name", label: "A to Z" },
] as const;

export const styleHref = (style: string, autoModel: boolean): string => `/ai-studio/image?style=${encodeURIComponent(style)}${autoModel ? "&model=preset" : ""}`;

export function BrowseStyles({ open, onClose, styles }: Props) {
  const [order, setOrder] = useState<string>("featured");
  const [search, setSearch] = useState("");
  const [autoModel, setAutoModel] = useState(true);
  const words = search.trim().toLowerCase();
  const shown = styles.filter((one) => one.label.toLowerCase().includes(words));
  const sorted = order === "name" ? [...shown].sort((a, b) => a.label.localeCompare(b.label)) : shown;

  return (
    <Modal open={open} onClose={onClose} title="Browse styles" size="md">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select aria-label="Order" value={order} onChange={(event) => setOrder(event.target.value)} className="sm:w-44">
            {ORDERS.map((one) => (
              <option key={one.value} value={one.value}>
                {one.label}
              </option>
            ))}
          </Select>
          <SearchInput aria-label="Search styles" placeholder="Search styles" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        {sorted.length === 0 ? (
          <p className="text-body text-muted">No style matches “{search.trim()}”.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {sorted.map((style, index) => (
              <li key={style.value}>
                <Link href={styleHref(style.value, autoModel) as Route} className="flex flex-col gap-2 text-text no-underline" onClick={onClose}>
                  <ToneArt tone={TONES[index % TONES.length]!} />
                  <span className="text-small font-semibold">{style.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Toggle checked={autoModel} onChange={setAutoModel} label="Auto-apply model" />
      </div>
    </Modal>
  );
}
