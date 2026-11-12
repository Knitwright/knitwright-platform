"use client";

import { Box, CloudUpload, Download, Image } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { Menu } from "@/components/ui/Menu";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/PageStates";
import { cx } from "@/components/ui/cx";
import { MOCKUP_CATEGORIES, MOCKUP_CATEGORY_LABELS, type MockupCategory } from "@/lib/mockups/gallery/categories";
import { downloadHref, mockupsHref, NO_DRAWING_LINE, type MockupCard as Card } from "@/lib/mockups/gallery/cards";
import { MockupCard, type ProductPicture } from "./MockupCard";

/**
 * The v3.9 Mockups page (09 screen 8, 08 §4.3, decision 0140): pick one of the brand's products
 * and every mockup shows it. The category, the product and the colourway are in the address, so a
 * link opens the same view; the selection for bulk download is the page's own.
 */

export type ProductChoice = Readonly<{ id: string; name: string }>;

export type MockupsViewProps = Readonly<{
  product: ProductPicture & Readonly<{ name: string; colourways: readonly Readonly<{ id: string; name: string }>[] }>;
  choices: readonly ProductChoice[];
  category: MockupCategory;
  cards: readonly Card[];
}>;

const TAB = "border-b-2 pb-3 text-body-lg font-medium whitespace-nowrap no-underline transition-colors duration-fast";
const CHIP = "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-small font-medium whitespace-nowrap no-underline transition-colors duration-fast";

function Toolbar({ product, choices, selected }: Readonly<{ product: MockupsViewProps["product"]; choices: readonly ProductChoice[]; selected: readonly string[] }>) {
  const router = useRouter();
  const pick = (id: string) => router.push(mockupsHref({ design: id, colourway: null, category: "all" }) as Route);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Menu
        label={`Use a product: ${product.name}`}
        icon={<Icon icon={Box} size={20} />}
        align="end"
        items={choices.map((one) => ({ id: one.id, label: one.name, onSelect: () => pick(one.id) }))}
      />
      <LinkButton href="/studio/start" variant="secondary" icon={<Icon icon={CloudUpload} size={20} />}>
        Upload
      </LinkButton>
      {selected.length === 0 ? (
        <Button disabledReason="Tick the mockups to download first" icon={<Icon icon={Download} size={20} />}>
          Download selected (0)
        </Button>
      ) : (
        <a href={downloadHref(product.id, product.colourwayId, selected)} download className={buttonClasses("primary", false, "no-underline")}>
          <Icon icon={Download} size={20} />
          Download selected ({selected.length})
        </a>
      )}
    </div>
  );
}

function Categories({ product, category }: Readonly<{ product: MockupsViewProps["product"]; category: MockupCategory }>) {
  return (
    <nav aria-label="Mockup categories" className="flex gap-6 overflow-x-auto border-b border-border">
      {MOCKUP_CATEGORIES.map((one) => (
        <Link
          key={one}
          href={mockupsHref({ design: product.id, colourway: product.colourwayId, category: one }) as Route}
          aria-current={one === category ? "page" : undefined}
          className={cx(TAB, one === category ? "border-text text-text" : "border-transparent text-muted live:hover:text-text")}
        >
          {MOCKUP_CATEGORY_LABELS[one]}
          {one === "renders" ? " · free" : ""}
        </Link>
      ))}
    </nav>
  );
}

function Colourways({ product, category }: Readonly<{ product: MockupsViewProps["product"]; category: MockupCategory }>) {
  return (
    <nav aria-label="Colourway" className="flex flex-wrap items-center gap-2">
      {product.colourways.map((one) => (
        <Link
          key={one.id}
          href={mockupsHref({ design: product.id, colourway: one.id, category }) as Route}
          aria-current={one.id === product.colourwayId ? "true" : undefined}
          className={cx(CHIP, one.id === product.colourwayId ? "border-navy bg-navy text-on-dark" : "border-border bg-bg text-text-2 live:hover:bg-soft")}
        >
          {one.name}
        </Link>
      ))}
      <span className="px-2 text-small text-muted">Colourway</span>
    </nav>
  );
}

export function MockupsView({ product, choices, category, cards }: MockupsViewProps) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const toggle = (slug: string) => setPicked((now) => (now.has(slug) ? new Set([...now].filter((one) => one !== slug)) : new Set([...now, slug])));
  const selected = cards.filter((card) => picked.has(card.slug)).map((card) => card.slug);
  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 text-text">Mockups for every kit</h1>
        <Toolbar product={product} choices={choices} selected={selected} />
      </div>
      <Categories product={product} category={category} />
      <Colourways product={product} category={category} />
      {product.front === null ? <Notice tone="warn">{NO_DRAWING_LINE}</Notice> : null}
      {cards.length === 0 ? (
        <EmptyState icon={<Icon icon={Image} size={22} />} title="No mockups here yet" action={<LinkButton href={mockupsHref({ design: product.id, colourway: product.colourwayId, category: "all" }) as Route}>Show every mockup</LinkButton>}>
          The library has no scene in this category yet.
        </EmptyState>
      ) : (
        <ul aria-label="Mockups" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <li key={card.slug}>
              <MockupCard card={card} product={product} selected={picked.has(card.slug)} onToggle={() => toggle(card.slug)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
