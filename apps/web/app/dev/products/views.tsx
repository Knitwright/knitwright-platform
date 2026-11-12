import { CatalogueSearch, SwatchBookButton } from "@/components/products/Coming";
import { DesignThis } from "@/components/products/Configurator";
import { CategoryHero, FilterBar, SubCategoryChips } from "@/components/products/CategoryParts";
import { CardRow, CategoryTiles, Discover, EcoBand, ProBanner, Questions } from "@/components/products/HomeSections";
import { IdeaTile } from "@/components/products/IdeaTile";
import { NoProducts, ProductTable, StageChips } from "@/components/products/MyProducts";
import { Fulfilment, Gallery, InfoRow, Ladder, MadeBy, TitleBlock, Breadcrumb } from "@/components/products/ProductParts";
import { ProductsHeader } from "@/components/products/ProductsHeader";
import { DecorationTabs, SizeGuideTable } from "@/components/products/ProductTabs";
import { ProductGrid } from "@/components/products/ProductTile";
import { sizeChart } from "@/lib/home/article-view";
import { ladderRows } from "@/lib/home/price";
import { WEARER_OPTIONS } from "@/lib/projects/wearers";
import { productCard, productCards } from "@/lib/products/cards";
import { categoriesOf, findCategory, inCategory, subCategoriesOf } from "@/lib/products/categories";
import { categoryView } from "@/lib/products/category";
import { configuratorGroups, defaultChoices } from "@/lib/products/configurator";
import { bullets, decorations, fabricCards, fulfilmentFacts } from "@/lib/products/detail";
import { DEV_IDEAS, DEV_PRODUCTS, devArticles, devContext, devSource, devSummaries } from "@/lib/products/fixtures/dev";
import { discoverLinks, faqs, homeRows } from "@/lib/products/home";
import { productRows, stageChips } from "@/lib/products/mine";
import { renderOf } from "@/lib/products/render";
import { MY_PRODUCTS_PATH, PRODUCTS_PATH, TRENDS_PATH } from "@/lib/products/routes";
import { sizeGuide } from "@/lib/products/size-guide";
import { ideaTiles } from "@/lib/products/trends";

/** The /dev/products views, one per prototype render (p01, p02, p03, p04, p05, p08), drawn from fixture data. */

const typeOf = (slug: string) => inCategory(devSummaries(), slug).find((one) => one.registryTypeId !== null)?.registryTypeId ?? null;

export function HomeView() {
  const all = devSummaries();
  const rows = homeRows(all, devSource, []);
  return (
    <div className="flex flex-col gap-10 pb-16">
      <ProductsHeader title="Catalogue" current={PRODUCTS_PATH} actions={<><CatalogueSearch /><SwatchBookButton /></>} />
      <CategoryTiles categories={categoriesOf(all).slice(0, 6)} typeOf={typeOf} />
      <ProBanner lead="Sublimated in Sialkot, from 1 piece. Names and numbers are designed in the editor. Studio Pro pricing is not set yet." start={PRODUCTS_PATH} typeIds={all.map((one) => one.registryTypeId)} />
      <CardRow id="top-picks" title="Top picks for clubs" cards={productCards(rows.topPicks, devContext)} viewAll={PRODUCTS_PATH} />
      <CardRow id="one-piece" title="From one piece" cards={productCards(rows.onePiece, devContext)} viewAll={PRODUCTS_PATH} />
      <EcoBand cards={[]} />
      <Discover links={discoverLinks(all)} />
      <Questions faqs={faqs({ articles: all, source: devSource, leadTimeDays: 8, qcDays: null, freightDays: null })} />
    </div>
  );
}

export function CategoryView() {
  const all = devSummaries();
  const pool = inCategory(all, "training");
  const view = categoryView(all, "training", {});
  return (
    <div className="flex flex-col gap-6 pb-16">
      <CategoryHero category={findCategory(all, "training")!} typeId={typeOf("training")} />
      <SubCategoryChips slug="training" subs={subCategoriesOf(pool)} chosen={null} keep={{}} typeOf={(type) => pool.find((one) => one.articleType === type)?.registryTypeId ?? null} />
      <FilterBar slug="training" view={view} />
      <ProductGrid cards={productCards(view.articles, devContext)} label="Base products" />
    </div>
  );
}

export function ProductView({ open }: Readonly<{ open: boolean }>) {
  const article = devArticles()[0]!;
  const fabrics = fabricCards(article, [], []);
  const card = productCard({ ...article, fabricCodes: article.fabrics.map((fabric) => fabric.code) }, devContext);
  const groups = configuratorGroups(article);
  const design = (label?: string, show = false) => (
    <DesignThis code={article.code} name={article.name} label={label} groups={groups} initial={defaultChoices(groups)} wearers={WEARER_OPTIONS} render={renderOf(article.registryTypeId)} blocked={null} defaultOpen={show} />
  );
  const chart = sizeChart(article);
  return (
    <div className="flex flex-col gap-8 pb-16">
      <Breadcrumb name={article.name} category={{ slug: "football", label: "Football" }} />
      <div className="grid gap-8 lg:grid-cols-2">
        <Gallery typeId={article.registryTypeId} />
        <div className="flex flex-col gap-5">
          <TitleBlock name={article.name} code={article.code} maker={card.maker} classTag={card.classTag} status={card.status} bullets={bullets(article, fabrics)} />
          <DecorationTabs methods={decorations(fabrics, article.productionClass)} />
          <MadeBy lines={["Cut, sewn and printed by one factory partner in Sialkot", "Made in 8 working days from the weekly cut-off", "Every option is one the factory can make; unsampled ones stay locked"]} label="Fixture data">
            {design(undefined, open)}
            <SwatchBookButton size="lg" />
          </MadeBy>
        </div>
      </div>
      <Fulfilment factory="Knitwright Sialkot" facts={fulfilmentFacts({ factory: null, capability: undefined, priceLine: card.price.amount, priceLabel: card.price.label, priceRuleId: card.price.ruleId, parts: { qcDays: null, freightDays: null } })} swatches={[]} sizes="XS–3XL" action={design("Start designing")} />
      <Ladder rows={ladderRows(devSource(article.code).ladder, "GBP")} currency="GBP" />
      <InfoRow id="size-guide" title="Size guide">
        <SizeGuideTable guides={{ cm: sizeGuide(chart, "cm"), in: sizeGuide(chart, "in") }} sampleSize={chart.sampleSize} />
      </InfoRow>
    </div>
  );
}

export function MineView({ empty }: Readonly<{ empty: boolean }>) {
  const products = empty ? [] : DEV_PRODUCTS;
  const rows = productRows(products, "all", "");
  return (
    <div className="flex flex-col gap-6 pb-16">
      <ProductsHeader title="My products" current={MY_PRODUCTS_PATH} />
      <StageChips chips={stageChips(products, "")} current="all" />
      {rows.length === 0 ? <NoProducts filtered={false} /> : <ProductTable rows={rows} />}
    </div>
  );
}

export function TrendsView() {
  return (
    <div className="flex flex-col gap-6 pb-16">
      <ProductsHeader title="Trending ideas" current={TRENDS_PATH} actions={<CatalogueSearch />} />
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {ideaTiles(DEV_IDEAS, "all").map((tile) => (
          <IdeaTile key={tile.id} tile={tile} preview={null} />
        ))}
      </div>
    </div>
  );
}
