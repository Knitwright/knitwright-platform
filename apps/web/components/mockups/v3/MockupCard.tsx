"use client";

import { Download, Pencil, Ruler, Palette } from "lucide-react";
import type { CSSProperties } from "react";
import { StartLaunch } from "@/components/launch-start/StartLaunch";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PremiumMark } from "@/components/ui/Marks";
import { cx } from "@/components/ui/cx";
import { downloadHref, type MockupCard as Card } from "@/lib/mockups/gallery/cards";

/**
 * One mockup (09 screen 8): the chosen product on the scene, a checkbox for bulk download, ♛ on an
 * AI scene, and on hover or focus **Edit** (a launch canvas with a mockup board for it) and
 * **Download** (the finished picture, drawn by the same renderer as the board).
 */

export type ProductPicture = Readonly<{ id: string; colourwayId: string; front: string | null; back: string | null; alt: string }>;

type CardProps = Readonly<{ card: Card; product: ProductPicture; selected: boolean; onToggle: () => void }>;

/** The scene's own backdrop colours, which are data on its row, behind the drawing. */
const backdropStyle = (card: Card): CSSProperties => ({
  backgroundImage: `linear-gradient(160deg, ${card.backdrop.from}, ${card.backdrop.to ?? card.backdrop.from})`,
});

function Picture({ card, product }: Readonly<{ card: Card; product: ProductPicture }>) {
  if (card.chart !== null) {
    return (
      <span className="grid size-24 place-items-center rounded-xl bg-bg text-text-2 shadow-e1">
        <Icon icon={card.chart === "size-chart" ? Ruler : Palette} size={22} />
      </span>
    );
  }
  const src = card.view === "back" ? (product.back ?? product.front) : product.front;
  // A data address of a drawing made here: nothing in it can run, and there is nothing to optimise.
  // eslint-disable-next-line @next/next/no-img-element
  return src === null ? null : <img src={src} alt={product.alt} className="h-4/5 w-4/5 object-contain" />;
}

function Actions({ card, product }: Readonly<{ card: Card; product: ProductPicture }>) {
  return (
    <div className="absolute inset-x-3 bottom-3 flex gap-2 opacity-0 max-md:opacity-100 transition-opacity duration-fast group-hover:opacity-100 group-focus-within:opacity-100">
      <StartLaunch source="mockup" slug={card.slug} designProjectId={product.id} colourwayId={product.colourwayId} variant="primary" icon={<Icon icon={Pencil} size={16} />} label={`Edit ${card.title}`} className="flex-1">
        Edit
      </StartLaunch>
      {card.cannotDownload === null ? (
        <a href={downloadHref(product.id, product.colourwayId, [card.slug])} download className={buttonClasses("secondary", false, "flex-1 no-underline", "sm")}>
          <Icon icon={Download} size={16} />
          Download<span className="sr-only"> {card.title}</span>
        </a>
      ) : (
        <Button variant="secondary" disabledReason={card.cannotDownload} icon={<Icon icon={Download} size={16} />} aria-label={`Download ${card.title}`} className="flex-1">
          Download
        </Button>
      )}
    </div>
  );
}

export function MockupCard({ card, product, selected, onToggle }: CardProps) {
  const id = `mockup-${card.slug}`;
  return (
    <article aria-labelledby={id} className={cx("group flex flex-col overflow-hidden rounded-xl border bg-bg", selected ? "border-navy" : "border-border")}>
      <div className="relative grid aspect-[4/3] place-items-center" style={backdropStyle(card)}>
        <Picture card={card} product={product} />
        <label className="absolute top-3 left-3 grid size-7 cursor-pointer place-items-center rounded-sm bg-bg shadow-e1">
          <input type="checkbox" checked={selected} onChange={onToggle} disabled={card.cannotDownload !== null} className="size-4.5 accent-navy disabled:cursor-not-allowed" />
          <span className="sr-only">Select {card.title} for download</span>
        </label>
        {card.premium ? <PremiumMark label="AI scene, uses credits" className="absolute top-3 right-3 grid size-6 rounded-full bg-bg shadow-e1" /> : null}
        <Actions card={card} product={product} />
      </div>
      <div className="flex flex-col gap-0.5 px-4 py-3.5">
        <h2 id={id} className="truncate text-body-lg font-semibold text-text" title={card.title}>
          {card.title}
        </h2>
        <p className="text-caption text-muted">{card.line}</p>
      </div>
    </article>
  );
}
