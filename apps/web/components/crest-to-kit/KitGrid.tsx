"use client";

import Link from "next/link";
import type { Route } from "next";
import type { KitCardView } from "@/lib/crest-to-kit/view";
import { CARD_OPEN, CARD_QUOTE, KITS_TITLE } from "@/lib/crest-to-kit/words";

/**
 * The kits as cards (spec F-T2 step 5). Clicking a card opens that very kit in the configurator
 * (F-T1), because the card's address carries the kit itself — the colours, the quantity and the
 * base article's own option codes — which the configurator reads back.
 *
 * Every card shows the catalogue codes the factory reads, so the club and the factory are looking
 * at the same reference. No card shows a price or a date: the configurator shows the price from the
 * factory's own tiers, and no delivery date can be worked out from the data on file at all.
 */

export type KitGridProps = Readonly<{ kits: readonly KitCardView[]; count: string }>;

const Swatches = ({ colours, socks }: Readonly<{ colours: readonly string[]; socks: string }>) => (
  <span className="flex items-center gap-1.5" aria-hidden="true">
    {colours.map((hex, at) => (
      <span key={`${hex}-${at}`} className="size-5 rounded-full border border-white/25" style={{ backgroundColor: hex }} />
    ))}
    <span className="ml-1 h-5 w-2.5 rounded-sm border border-white/25" style={{ backgroundColor: socks }} />
  </span>
);

function Card({ kit }: Readonly<{ kit: KitCardView }>) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-4" data-testid={`crest-to-kit-card-${kit.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-medium text-ink">{kit.title}</h3>
        <Swatches colours={kit.colours} socks={kit.socksColour} />
      </div>
      <p className="text-[13px] leading-relaxed text-muted">{kit.note}</p>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
        <div className="flex gap-1.5">
          <dt className="text-muted">Codes</dt>
          <dd className="font-mono text-ink-2">{kit.codes}</dd>
        </div>
        {kit.delta === null ? null : (
          <div className="flex gap-1.5">
            <dt className="text-muted">Off your crest by</dt>
            <dd className="text-ink-2">ΔE00 {kit.delta}</dd>
          </div>
        )}
      </dl>
      {kit.warnings.length === 0 ? null : (
        <ul className="flex flex-col gap-1">
          {kit.warnings.map((warning) => (
            <li key={warning} className="text-[13px] leading-relaxed text-warn">
              {warning}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={kit.href as Route}
          className="inline-flex h-11 items-center rounded-full border border-white/20 bg-white/[0.04] px-4 text-[15px] text-ink no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft"
        >
          {CARD_OPEN}
        </Link>
        <a
          href={kit.quoteHref}
          className="soft-link text-[15px] text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft"
        >
          {CARD_QUOTE}
        </a>
      </div>
      <p className="font-mono text-[11px] text-faint">{kit.ruleIds.join(" · ")}</p>
    </li>
  );
}

export function KitGrid({ kits, count }: KitGridProps) {
  return (
    <section aria-labelledby="crest-kits" className="flex flex-col gap-3" data-testid="crest-to-kit-kits">
      <h2 id="crest-kits" className="text-base font-semibold text-ink">
        {KITS_TITLE}
      </h2>
      <p className="text-sm text-muted">{count}</p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kits.map((kit) => (
          <Card key={kit.id} kit={kit} />
        ))}
      </ul>
    </section>
  );
}
