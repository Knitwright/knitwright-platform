import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/shell/PageIntro";
import { ArticleNotes, ArticlePhotos, FabricCards, PriceLadder, SizeChartTable } from "@/components/studio/home/ArticleSections";
import { careNote, fabricCard, fitNotes, leadTime, sizeChart } from "@/lib/home/article-view";
import { STATUS_LABELS } from "@/lib/home/catalogue-view";
import { getBaseArticle } from "@/lib/catalogue";
import { getType } from "@/lib/garment";
import { MARKETS, marketFromQuery } from "@/lib/home/market";
import { ladderRows } from "@/lib/home/price";
import { priceBook } from "@/lib/home/reads";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Base product" };

/**
 * One base article (spec F-S8, "Article page"): the pictures, the price ladder, the fabrics with
 * their spec cards, the size chart, the fit notes, the care wording and the lead time, with a
 * UK | GBP / AU | AUD selector.
 *
 * Every value comes from X1's article rows (decision 0066) or X6's factory model (decision 0071).
 * Nothing is invented: a value no row holds says so and carries the rule that would explain it.
 */
export default async function ArticlePage({ params, searchParams }: PageProps<"/catalogue/[code]">) {
  await requireMember();
  const { code } = await params;
  const market = marketFromQuery((await searchParams).market);
  const article = await getBaseArticle(await sessionClient(), code.toUpperCase());
  if (!article) notFound();
  const book = await priceBook();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageIntro eyebrow={`${article.code} · Class ${article.productionClass}`} title={article.name} lead={STATUS_LABELS[article.status]} />
        <nav aria-label="Market and currency" className="flex flex-wrap gap-2">
          {MARKETS.map((entry) => (
            <Link
              key={entry.id}
              href={`/catalogue/${article.code}?market=${entry.id}` as Route}
              aria-current={entry.id === market.id ? "true" : undefined}
              className={`nav-pill inline-flex min-h-10 items-center rounded-full border px-4 text-[14.5px] no-underline ${
                entry.id === market.id ? "border-white/25 bg-white/12 text-white" : "border-white/12 text-muted"
              }`}
            >
              {entry.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="text-[13px] text-faint">{article.dataLabel}</p>
      <div className="grid gap-5 lg:grid-cols-2">
        <ArticlePhotos name={article.name} />
        <PriceLadder rows={ladderRows(book.source(article.code).ladder, market.currency)} currency={market.currency} />
      </div>
      <FabricCards cards={article.fabrics.map((fabric) => fabricCard(fabric, book.fabrics, book.colours))} />
      <SizeChartTable chart={sizeChart(article)} />
      <ArticleNotes fit={fitNotes(article)} care={careNote()} lead={leadTime(book.capability(article.code))} />
      <StartFrom typeId={article.registryTypeId} />
    </>
  );
}

/**
 * The hand-off into the editor. The editor is reached through the new-design screen, which asks for
 * the garment by name, so the link says which one to pick rather than pretending to pass it on.
 */
function StartFrom({ typeId }: Readonly<{ typeId: string | null }>) {
  const label = typeId === null ? null : (getType(typeId)?.label ?? null);
  return (
    <section aria-labelledby="start-from" className="glass flex flex-col gap-3 rounded-[1.75rem] p-5 sm:p-6">
      <h2 id="start-from" className="text-lg font-medium tracking-[-0.01em] text-ink">
        Start a design from this base
      </h2>
      {label === null ? (
        <p className="text-[15px] text-ink-2">
          This base has no garment in the editor yet, so there is nothing to open. It is coming in a later release.
        </p>
      ) : (
        <>
          <p className="text-[15px] text-ink-2">{`Choose "${label}" on the next screen.`}</p>
          <Link href="/studio/new" className="chip-btn inline-flex min-h-11 w-fit items-center rounded-full border border-white/20 px-5 text-[15px] font-medium text-ink no-underline">
            New design
          </Link>
        </>
      )}
    </section>
  );
}
