import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { WhyLink } from "@/components/rulebook/WhyLink";
import { Tag } from "@/components/ui/Chips";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { LogoTile } from "@/components/ui/Marks";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { RENDER_NOTICE } from "@/lib/home/article-view";
import type { LadderRow } from "@/lib/home/price";
import type { Fact, Swatch } from "@/lib/products/detail";
import { categoryHref, PRODUCTS_PATH } from "@/lib/products/routes";
import { ProductRender } from "./ProductRender";

/** The parts of the product page (09 screen 11; prototype p03), top to bottom. */

export function Breadcrumb({ name, category }: Readonly<{ name: string; category: Readonly<{ slug: string; label: string }> | null }>) {
  return (
    <nav aria-label="Breadcrumb" className="pt-6">
      <ol className="flex flex-wrap items-center gap-2 text-h3 text-text-2">
        <li className="flex items-center gap-2">
          <Link href={PRODUCTS_PATH} className="inline-flex items-center gap-2 text-text-2 no-underline hover:text-text">
            <Icon icon={ArrowLeft} size={20} />
            Catalogue
          </Link>
          <span aria-hidden="true">›</span>
        </li>
        {category ? (
          <li className="flex items-center gap-2">
            <Link href={categoryHref(category.slug)} className="text-text-2 no-underline hover:text-text">
              {category.label}
            </Link>
            <span aria-hidden="true">›</span>
          </li>
        ) : null}
        <li aria-current="page" className="text-text">
          {name}
        </li>
      </ol>
    </nav>
  );
}

/** The gallery: the render on `soft`, labelled as a render, not a photograph. */
export function Gallery({ typeId }: Readonly<{ typeId: string | null }>) {
  return (
    <section aria-label="Pictures" className="flex flex-col gap-3">
      <div className="relative grid aspect-square place-items-center rounded-2xl bg-soft">
        <span className="absolute top-4 left-4 rounded-full bg-bg px-3 py-1 text-caption font-semibold text-text shadow-e1">{RENDER_NOTICE.label}</span>
        <ProductRender typeId={typeId} describe className="w-2/3" />
      </div>
      <p className="text-caption text-muted">{RENDER_NOTICE.note}</p>
    </section>
  );
}

export function TitleBlock({ name, code, maker, classTag, status, bullets }: Readonly<{ name: string; code: string; maker: string; classTag: string; status: string; bullets: readonly string[] }>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Tag tone="beta">{status}</Tag>
        <Tag tone="info">{classTag}</Tag>
      </div>
      <h1 className="text-h1 text-text">{name}</h1>
      <p className="text-body text-muted">
        <span className="font-mono">{code}</span> · {maker}
      </p>
      <ul className="list-disc pl-5 text-body text-text-2">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </div>
  );
}

/** "Made by Knitwright": the factory, what the rows say about it, and the two buttons. */
export function MadeBy({ lines, label, children }: Readonly<{ lines: readonly string[]; label: string | null; children: ReactNode }>) {
  return (
    <section aria-labelledby="made-by" className="flex flex-col gap-3 rounded-xl border border-gold bg-gold-soft p-5">
      <h2 id="made-by" className="flex items-center gap-2 text-title text-text">
        <LogoTile className="size-6" />
        Made by Knitwright
      </h2>
      <ul className="flex flex-col gap-1.5 text-body text-text-2">
        {lines.map((line) => (
          <li key={line} className="flex items-start gap-2">
            <Icon icon={Check} size={16} className="mt-0.5 shrink-0 text-ok" />
            {line}
          </li>
        ))}
      </ul>
      {label ? <p className="text-caption text-muted">{label}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const FACT_LABEL = "text-micro uppercase text-muted";

/** The Fulfilment box: the factory, then quality, price, shipping and production, then colours, sizes and options. */
export function Fulfilment({ factory, facts, swatches, sizes, action }: Readonly<{ factory: string; facts: readonly Fact[]; swatches: readonly Swatch[]; sizes: string; action: ReactNode }>) {
  return (
    <section aria-labelledby="fulfilment" className="flex flex-col gap-4">
      <div>
        <h2 id="fulfilment" className="text-h2 text-text">
          Fulfilment
        </h2>
        <p className="text-body text-muted">Shown for the market chosen above. Prices are placeholders until the factory quotes.</p>
      </div>
      <div className="flex flex-col gap-5 rounded-2xl bg-soft p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-3 text-title text-text">
            <LogoTile className="size-8" />
            {factory}
          </p>
          {action}
        </div>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-1">
              <dt className={FACT_LABEL}>{fact.label}</dt>
              <dd className="flex items-center gap-2 text-title text-text">
                {fact.value} <WhyLink ruleId={fact.ruleId} context={`fulfilment ${fact.label.toLowerCase()}`} />
              </dd>
              {fact.note ? <dd className="text-caption text-muted">{fact.note}</dd> : null}
            </div>
          ))}
        </dl>
        <dl className="grid gap-5 border-t border-border pt-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <dt className={FACT_LABEL}>Colours</dt>
            <dd>
              {swatches.length === 0 ? (
                <span className="text-body text-muted">Any colour with sublimation; no stock colour is listed.</span>
              ) : (
                <ul aria-label="Stock colours" className="flex flex-wrap gap-1.5">
                  {swatches.map((swatch) => (
                    // The swatch's own colour is data from the fabric programme, so it is set inline.
                    <li key={`${swatch.name}-${swatch.hex}`} title={swatch.name} className="size-4 rounded-full border border-border" style={{ backgroundColor: swatch.hex }}>
                      <span className="sr-only">{swatch.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className={FACT_LABEL}>Sizes</dt>
            <dd className="text-title text-text">{sizes}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

/** The price ladder as one row per quantity, from the factory's tiers; each tier with its label and its Why?. */
export function Ladder({ rows, currency }: Readonly<{ rows: readonly LadderRow[]; currency: string }>) {
  return (
    <section aria-labelledby="price-ladder" className="flex flex-col gap-3">
      <h2 id="price-ladder" className="text-title text-text">
        Price ladder
      </h2>
      {rows.length === 0 ? (
        <p className="text-body text-muted">{`No price tier is set for this base yet, in ${currency} or any currency.`}</p>
      ) : (
        <Table caption={`Price per piece in ${currency}`}>
          <thead>
            <tr>
              <Th>Pieces</Th>
              <Th numeric>Price / piece</Th>
              <Th>Source</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.quantity}>
                <Td>{row.quantity}</Td>
                <Td numeric className={cx(!row.priced && "text-muted")}>
                  {row.unit}
                </Td>
                <Td>
                  <span className="flex items-center gap-2 text-caption text-muted">
                    {row.label} <WhyLink ruleId={row.ruleId} context="price ladder" />
                  </span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}

/** One two-column section: the heading on the left, the body on the right (About, Key features, Care, Size guide). */
export function InfoRow({ id, title, children }: Readonly<{ id: string; title: string; children: ReactNode }>) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-border py-6 md:grid-cols-[1fr_2fr]">
      <h2 id={id} className="text-h3 text-text">
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
