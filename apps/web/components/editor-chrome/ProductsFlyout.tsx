"use client";

import { Package, Search, Shirt } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { productHref, PRODUCTS_PATH } from "@/lib/products/routes";
import { sportChips, shelfMatches, type ProductsShelf } from "@/lib/editor-chrome/products";

type Props = Readonly<{
  shelf: ProductsShelf;
  /** False for a member who may look but not change the canvas. */
  canEdit: boolean;
  busy: boolean;
  onPlace: (designProjectId: string, name: string) => void;
}>;

const CARD = "flex h-34 w-29 shrink-0 flex-col justify-between overflow-hidden rounded-md border border-border bg-bg p-2 text-left no-underline hover:border-electric";

/**
 * THE PRODUCTS FLYOUT (`08` §5.4 "Products", modelled on Kittl's Printful panel; prototype e03;
 * decision 0146): search, chips by sport, and two shelves.
 *
 *   * **My products**: the brand's designs. Pressing one places it on the canvas as a Garment
 *     board, at its current version, checked as the editor checks it (E1's mapping).
 *   * **Knitwright bases**: the catalogue's base articles. Each opens its product page, whose
 *     "Create my design" makes a design from the base with only its approved options (P4,
 *     decision 0142) -- the one door that may make a design, so it is not repeated here.
 */
export function ProductsFlyout({ shelf, canEdit, busy, onPlace }: Props) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState<string | null>(null);
  const found = shelfMatches(shelf, query, sport);
  const chips = sportChips(shelf.bases ?? []);

  return (
    <div className="flex flex-col gap-3" data-testid="editor-products">
      <label htmlFor={searchId} className="sr-only">
        Search products
      </label>
      <div className="flex h-11.5 items-center gap-2 rounded-lg border border-border px-3.5 text-body-lg">
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products"
          className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-muted-2"
        />
        <Icon icon={Search} className="text-text-2" />
      </div>
      <div role="group" aria-label="Sport" className="flex gap-4.5 overflow-x-auto border-b border-border [scrollbar-width:none]">
        {[null, ...chips].map((one) => (
          <button
            key={one ?? "all"}
            type="button"
            aria-pressed={sport === one}
            onClick={() => setSport(one)}
            className={cx("shrink-0 border-b-2 pt-1.5 pb-2.5 text-body font-medium capitalize", sport === one ? "border-text text-text" : "border-transparent text-muted")}
          >
            {one ?? "All"}
          </button>
        ))}
      </div>

      <Shelf title="My products" more={{ href: "/products/mine", label: "Show all" }}>
        {found.designs === null ? (
          <Unread what="your designs" />
        ) : found.designs.length === 0 ? (
          <p className="text-small text-muted" data-testid="editor-products-empty">
            {query === "" ? "No designs yet. Start one from a base below." : "No design matches that search."}
          </p>
        ) : (
          found.designs.map((design) => (
            <button
              key={design.id}
              type="button"
              disabled={!canEdit || busy}
              title={canEdit ? `Place ${design.name} on the canvas` : "Only owners, admins and kit managers can change this project."}
              onClick={() => onPlace(design.id, design.name)}
              className={cx(CARD, "disabled:cursor-not-allowed disabled:opacity-60")}
              data-testid={`editor-product-design-${design.id}`}
            >
              <span className="grid flex-1 place-items-center text-navy">
                <Icon icon={Shirt} size={22} />
              </span>
              <span className="truncate text-caption font-bold text-text-2">{design.name}</span>
            </button>
          ))
        )}
      </Shelf>

      <Shelf title="Knitwright bases" more={{ href: PRODUCTS_PATH, label: "Show all" }}>
        {found.bases === null ? (
          <Unread what="the catalogue" />
        ) : found.bases.length === 0 ? (
          <p className="text-small text-muted">No base matches that search.</p>
        ) : (
          found.bases.map((base) => (
            <Link key={base.code} href={productHref(base.code)} className={CARD} data-testid={`editor-product-base-${base.code}`}>
              <span className="grid flex-1 place-items-center text-muted-2">
                <Icon icon={Package} size={22} />
              </span>
              <span className="flex flex-col">
                <span className="truncate text-caption font-bold text-text-2">{base.code}</span>
                <span className="truncate text-caption text-muted">{base.name}</span>
              </span>
            </Link>
          ))
        )}
      </Shelf>
    </div>
  );
}

function Shelf({ title, more, children }: Readonly<{ title: string; more: { href: "/products/mine" | "/products"; label: string }; children: ReactNode }>) {
  return (
    <section aria-label={title} className="flex flex-col gap-2.5 rounded-xl bg-soft p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-body font-semibold text-text">{title}</h3>
        <Link href={more.href} className="text-small font-medium text-muted no-underline hover:text-text">
          {more.label}
        </Link>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">{children}</div>
    </section>
  );
}

function Unread({ what }: Readonly<{ what: string }>) {
  return (
    <p role="status" className="text-small text-bad">
      We could not read {what}. Reload the page to try again.
    </p>
  );
}
