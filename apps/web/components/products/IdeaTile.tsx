"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { cx } from "@/components/ui/cx";
import { Spinner } from "@/components/ui/Icon";
import type { IdeaTile as Tile } from "@/lib/products/trends";
import { useTemplateAction } from "@/lib/templates/actions";

/**
 * One idea in the Trending ideas masonry (prototype p08). The whole tile is the button: pressing it makes a copy of
 * the template in the brand and opens the editor on it, through the template library's own action.
 */

const HEIGHTS: Readonly<Record<Tile["height"], string>> = { short: "h-56", medium: "h-72", tall: "h-88" };

const TONES: Readonly<Record<Tile["tone"], string>> = {
  navy: "bg-navy text-on-dark",
  soft: "bg-soft-2 text-text",
  gold: "bg-gold text-navy",
  electric: "bg-link text-on-dark",
  dark: "bg-text text-on-dark",
};

export function IdeaTile({ tile, preview }: Readonly<{ tile: Tile; preview: Readonly<{ src: string; alt: string }> | null }>) {
  const { form, submit, pending, summary } = useFormAction(useTemplateAction);
  return (
    <form ref={form} action={submit} className="mb-4 break-inside-avoid">
      <FormSummary message={summary} />
      <input type="hidden" name="templateId" value={tile.id} />
      <button
        type="submit"
        disabled={pending}
        className={cx(
          "relative flex w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-xl p-6 transition-shadow duration-fast ease-out hover:shadow-e2 disabled:cursor-wait",
          HEIGHTS[tile.height],
          TONES[tile.tone],
        )}
      >
        {/* A data address drawn by our own renderer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview.src} alt="" className="h-28 w-auto rounded-md bg-bg p-2" /> : null}
        <span className="text-h3 uppercase">
          <span className="sr-only">Start a design from </span>
          {tile.title}
        </span>
        <span className="text-small">{tile.caption}</span>
        {pending ? <Spinner size={20} className="absolute top-4 right-4" /> : null}
      </button>
    </form>
  );
}
