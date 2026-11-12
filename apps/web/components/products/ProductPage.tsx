import { notFound } from "next/navigation";
import { WhyLink } from "@/components/rulebook/WhyLink";
import { LockMark } from "@/components/ui/Marks";
import { getBaseArticle } from "@/lib/catalogue";
import type { BaseArticle } from "@/lib/catalogue/types";
import { careNote, sizeChart } from "@/lib/home/article-view";
import type { Market } from "@/lib/home/market";
import { ladderRows } from "@/lib/home/price";
import { loadMarketSummary } from "@/lib/markets/server";
import { WEARER_OPTIONS } from "@/lib/projects/wearers";
import { productCard, productCards, sizeSpan } from "@/lib/products/cards";
import { categoriesOf } from "@/lib/products/categories";
import { configuratorGroups, defaultChoices } from "@/lib/products/configurator";
import { NO_GARMENT_YET } from "@/lib/products/design";
import { bullets, decorations, fabricCards, fulfilmentFacts, optionsAvailable, rulesSummary, sameSports, swatchesOf } from "@/lib/products/detail";
import { renderOf } from "@/lib/products/render";
import { productHref } from "@/lib/products/routes";
import { cardContext, loadProducts, type ProductsData } from "@/lib/products/server";
import { sizeGuide } from "@/lib/products/size-guide";
import { sessionClient } from "@/lib/server/deps";
import { SwatchBookButton } from "./Coming";
import { DesignThis } from "./Configurator";
import { MarketDetails } from "./MarketDetails";
import { MarketNav } from "./MarketNav";
import { Breadcrumb, Fulfilment, Gallery, InfoRow, Ladder, MadeBy, TitleBlock } from "./ProductParts";
import { DecorationTabs, SizeGuideTable } from "./ProductTabs";
import { ProductGrid } from "./ProductTile";

/**
 * The product page (plan v6 P4, decision 0142; 09 screen 11, prototype p03). Every value comes from the article's
 * rows (decision 0066) or the factory model (decision 0071); a value no row holds says so, with its rule.
 */
export async function ProductPage({ code, market }: Readonly<{ code: string; market: Market }>) {
  const article = await getBaseArticle(await sessionClient(), code);
  if (!article) notFound();
  const data = await loadProducts(market);
  const summary = await loadMarketSummary(market, data.book.source(article.code), data.book.capability(article.code)?.leadTimeDays ?? null);
  const category = categoriesOf(data.articles).find((one) => article.sportTags.includes(one.slug)) ?? null;
  const fabrics = fabricCards(article, data.book.fabrics, data.book.colours);
  const card = productCard({ ...article, fabricCodes: article.fabrics.map((fabric) => fabric.code) }, cardContext(data, market));

  return (
    <div className="flex flex-col gap-8 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Breadcrumb name={article.name} category={category} />
        <MarketNav path={productHref(article.code)} market={market} />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Gallery typeId={article.registryTypeId} />
        <div className="flex flex-col gap-5">
          <TitleBlock name={article.name} code={article.code} maker={card.maker} classTag={card.classTag} status={card.status} bullets={bullets(article, fabrics)} />
          <p className="text-caption text-muted">{article.dataLabel}</p>
          <DecorationTabs methods={decorations(fabrics, article.productionClass)} />
          <MadeBy lines={madeByLines(data, article)} label={data.factory?.label ?? null}>
            <Design article={article} />
            <SwatchBookButton size="lg" />
          </MadeBy>
        </div>
      </div>
      <Fulfilment
        factory={data.factory ? `Knitwright ${data.factory.city}` : "No factory on file yet"}
        facts={fulfilmentFacts({ factory: data.factory, capability: data.book.capability(article.code), priceLine: card.price.amount, priceLabel: card.price.label, priceRuleId: card.price.ruleId, parts: { qcDays: data.qcDays, freightDays: data.freightDays } })}
        swatches={swatchesOf(fabrics)}
        sizes={sizeSpan(article.sizeRange) ?? "Not set yet"}
        action={<Design article={article} label="Start designing" />}
      />
      <Ladder rows={ladderRows(data.book.source(article.code).ladder, market.currency)} currency={market.currency} />
      <MarketDetails summary={summary} />
      <Sections article={article} fabricsAbout={fabrics.map((fabric) => fabric.description).filter((text): text is string => text !== null)} priceRuleId={card.price.ruleId} />
      <section aria-labelledby="same-sports" className="flex flex-col gap-4">
        <h2 id="same-sports" className="text-h2 text-text">
          For the same sports
        </h2>
        <ProductGrid cards={productCards(sameSports(article, data.articles), cardContext(data, market))} label="For the same sports" />
      </section>
    </div>
  );
}

function Design({ article, label }: Readonly<{ article: BaseArticle; label?: string }>) {
  const groups = configuratorGroups(article);
  return (
    <DesignThis
      code={article.code}
      name={article.name}
      label={label}
      groups={groups}
      initial={defaultChoices(groups)}
      wearers={WEARER_OPTIONS}
      render={renderOf(article.registryTypeId)}
      blocked={article.registryTypeId === null ? NO_GARMENT_YET : null}
    />
  );
}

/** What the card says about the factory: where it is, its lead time, and the class. Nothing it has not agreed. */
function madeByLines(data: ProductsData, article: BaseArticle): readonly string[] {
  const lead = data.book.capability(article.code)?.leadTimeDays ?? null;
  return [
    data.factory ? `Cut, sewn and printed by one factory partner in ${data.factory.city}` : "No factory partner is on file yet",
    lead === null ? "Production time not set yet" : `Made in ${lead} working days from the weekly cut-off`,
    "Every option is one the factory can make; unsampled ones stay locked",
  ];
}

function Sections({ article, fabricsAbout, priceRuleId }: Readonly<{ article: BaseArticle; fabricsAbout: readonly string[]; priceRuleId: string }>) {
  const care = careNote();
  const chart = sizeChart(article);
  const options = optionsAvailable(article);
  return (
    <div className="flex flex-col">
      <InfoRow id="about" title="About">
        <p className="text-body text-text-2">{fabricsAbout[0] ?? article.sourceNote ?? "No description is on file for this base yet."}</p>
      </InfoRow>
      <InfoRow id="key-features" title="Options available">
        {options.length === 0 ? (
          <p className="text-body text-muted">No option is on file for this base yet. Its options arrive with the factory&rsquo;s pattern master.</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            {options.map((group) => (
              <div key={group.group} className="flex flex-col gap-1">
                <dt className="flex items-center gap-2 text-body font-semibold text-text">
                  {group.group} <WhyLink ruleId={group.ruleId} context="options available" />
                </dt>
                {group.choices.map((choice) => (
                  <dd key={choice.full} title={choice.full} className="flex items-center gap-1.5 text-small text-text-2">
                    {choice.label}
                    {choice.sampled ? null : <LockMark label="Not yet sampled" className="text-muted" />}
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        )}
      </InfoRow>
      <InfoRow id="care" title="Care instructions">
        <p className="flex flex-wrap items-center gap-2 text-body text-text-2">
          {care.value} <WhyLink ruleId={care.ruleId} context="care" />
        </p>
      </InfoRow>
      <InfoRow id="size-guide" title="Size guide">
        <SizeGuideTable guides={{ cm: sizeGuide(chart, "cm"), in: sizeGuide(chart, "in") }} sampleSize={chart.sampleSize} />
      </InfoRow>
      <InfoRow id="rules" title="Rules">
        <ul className="flex flex-col gap-1.5 text-body text-text-2">
          {rulesSummary(article, priceRuleId).map((rule) => (
            <li key={`${rule.text}-${rule.ruleId}`} className="flex flex-wrap items-center gap-2">
              {rule.text} <WhyLink ruleId={rule.ruleId} context="rules summary" />
            </li>
          ))}
        </ul>
      </InfoRow>
    </div>
  );
}
