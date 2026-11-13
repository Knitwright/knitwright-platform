"use client";

import { useMemo, useState } from "react";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { SelectField } from "@/components/ui/SelectField";
import { formatMoney } from "@/lib/factory/pricing";
import { CHANNEL_LABELS, describeMargin, marginFor, retailFromText, SELLER_CHANNELS, type ChannelFee, type SellerChannel } from "@/lib/store-pages/margin";
import type { CalculatorArticle, CalculatorMarket } from "@/lib/store-pages/read";

/**
 * THE MARGIN CALCULATOR (spec F-L7; decision 0156): profit per unit at a retail price, from the factory's price
 * ladder, the market's freight and duty rows, the channel's fee row and the Knitwright fee. Every figure is a row;
 * what is missing is said, never a zero that hides itself (`margin.ts`).
 */

type Props = Readonly<{
  articles: readonly CalculatorArticle[];
  markets: readonly CalculatorMarket[];
  fees: readonly ChannelFee[];
  knitwrightFeeBps: number;
}>;

const smallestTier = (article: CalculatorArticle | undefined): number => Math.min(...(article?.ladder.map((tier) => tier.qtyMin) ?? [1]));

export function MarginCalculator({ articles, markets, fees, knitwrightFeeBps }: Props) {
  const [articleCode, setArticleCode] = useState(articles[0]?.code ?? "");
  const [country, setCountry] = useState(markets.find((market) => market.country === "GB")?.country ?? markets[0]?.country ?? "");
  const [channel, setChannel] = useState<SellerChannel>("storefront");
  const article = articles.find((one) => one.code === articleCode);
  const [qtyText, setQtyText] = useState(String(smallestTier(articles[0])));
  const [retailText, setRetailText] = useState("");
  const market = markets.find((one) => one.country === country);

  const qty = Number.parseInt(qtyText, 10);
  const retailMinor = retailFromText(retailText);
  const margin = useMemo(() => {
    if (!article || !market || retailMinor === null || !Number.isInteger(qty) || qty < 1) return null;
    const rates = market.rates[article.code];
    if (!rates) return null;
    const fee = fees.find((one) => one.channel === channel && one.currency === market.currency) ?? null;
    return marginFor({ ladder: article.ladder, rates, currency: market.currency, qty, retailMinor, fee, knitwrightFeeBps });
  }, [article, market, retailMinor, qty, fees, channel, knitwrightFeeBps]);

  if (articles.length === 0 || markets.length === 0) {
    return <Notice tone="info">No article has a price on file yet, so there is nothing to work a margin out from.</Notice>;
  }
  const cur = market?.currency ?? "GBP";
  const show = (minor: number) => formatMoney(minor, cur);

  return (
    <div className="grid gap-6 rounded-xl border border-border bg-bg p-5 lg:grid-cols-2" data-testid="margin-calculator">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()} aria-label="Margin calculator">
        <SelectField name="article" label="Product" value={articleCode} onChange={(event) => { setArticleCode(event.target.value); setQtyText(String(smallestTier(articles.find((one) => one.code === event.target.value)))); }} options={articles.map((one) => ({ id: one.code, label: `${one.name} (${one.code})` }))} />
        <SelectField name="market" label="Sold into" value={country} onChange={(event) => setCountry(event.target.value)} options={markets.map((one) => ({ id: one.country, label: `${one.name} (${one.currency})` }))} />
        <SelectField name="channel" label="Sold on" value={channel} onChange={(event) => setChannel(event.target.value as SellerChannel)} options={SELLER_CHANNELS.map((id) => ({ id, label: CHANNEL_LABELS[id] }))} />
        <Field name="qty" label="Batch size" inputMode="numeric" value={qtyText} onChange={(event) => setQtyText(event.target.value)} hint="The price tier is read at the batch the sale is made in." />
        <div className="sm:col-span-2">
          <Field name="retail" label={`Retail price (${cur})`} inputMode="decimal" placeholder="45.00" value={retailText} onChange={(event) => setRetailText(event.target.value)} />
        </div>
      </form>
      <div aria-live="polite" className="flex flex-col gap-3">
        {margin === null ? (
          <p className="text-body text-muted">Type a retail price to see your profit per unit.</p>
        ) : margin.status === "no-price" ? (
          <Notice tone="warn">{margin.reason}</Notice>
        ) : (
          <>
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-body" data-testid="margin-lines">
              <dt className="text-muted">Retail price</dt>
              <dd className="text-right tabular-nums text-text">{show(margin.retailMinor)}</dd>
              <dt className="text-muted">Base price (Knitwright)</dt>
              <dd className="text-right tabular-nums text-text">− {show(margin.baseMinor)}</dd>
              <dt className="text-muted">Freight</dt>
              <dd className="text-right tabular-nums text-text">− {show(margin.freightMinor)}</dd>
              <dt className="text-muted">Duty</dt>
              <dd className="text-right tabular-nums text-text">− {show(margin.dutyMinor)}</dd>
              <dt className="text-muted">Channel fee</dt>
              <dd className="text-right tabular-nums text-text">− {show(margin.channelFeeMinor)}</dd>
              <dt className="text-muted">Knitwright fee</dt>
              <dd className="text-right tabular-nums text-text">− {show(margin.knitwrightFeeMinor)}</dd>
              <dt className="border-t border-border pt-2 font-semibold text-text">Your profit per unit</dt>
              <dd className={`border-t border-border pt-2 text-right font-semibold tabular-nums ${margin.profitMinor < 0 ? "text-bad" : "text-ok"}`} data-testid="margin-profit">
                {show(margin.profitMinor)} · {describeMargin(margin.marginBps)}
              </dd>
            </dl>
            {margin.profitMinor < 0 ? <Notice tone="warn">This retail price is below what the product costs. Raise it before you sell.</Notice> : null}
            {margin.notes.length > 0 ? (
              <ul className="list-disc pl-5 text-small text-muted">
                {margin.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            <p className="text-small text-muted">Prices are placeholders until the owner sets them. {margin.labels.join(" · ")}</p>
          </>
        )}
      </div>
    </div>
  );
}
