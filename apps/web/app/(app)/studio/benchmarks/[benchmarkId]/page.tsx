import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddCard } from "@/components/benchmarks/AddCard";
import { ApplyPanel } from "@/components/benchmarks/ApplyPanel";
import { CardReview } from "@/components/benchmarks/CardReview";
import { CompareBoard } from "@/components/benchmarks/CompareBoard";
import { loadBenchmark } from "@/lib/benchmarks/load";
import { benchmarkStore } from "@/lib/benchmarks/server";
import { ARTICLE_CODE } from "@/lib/catalogue";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Benchmark" };

/**
 * One comparison (spec F-S2 steps 4 to 6): the cards side by side with how every value is known, the feature matrix,
 * the complaint themes, the confirm-and-correct step for each card, and the mapping onto a base product with the
 * design-around warning beside it.
 */
export default async function BenchmarkPage({ params, searchParams }: PageProps<"/studio/benchmarks/[benchmarkId]">) {
  const { brand, userId } = await requireMember();
  const { benchmarkId } = await params;
  const query = await searchParams;
  const asked = typeof query.article === "string" && ARTICLE_CODE.test(query.article) ? query.article : null;
  const screen = await loadBenchmark(await sessionClient(), await benchmarkStore(), { brandId: brand.id, userId }, { benchmarkId, articleCode: asked });
  if (screen === null) notFound();
  const planOf = (cardId: string) => screen.plans.find((plan) => plan.cardId === cardId)?.plan ?? null;
  const reportOf = (cardId: string) => screen.designAround.find((found) => found.cardId === cardId)?.report ?? null;

  return (
    <>
      <header>
        <Link href="/studio/benchmarks" className="font-mono text-xs uppercase tracking-wider text-muted">
          Benchmarks
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{screen.benchmark.title}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          A comparison, never a copy. Each value says how it is known: stated on the page, read off a picture, or not
          known. Check each card and correct anything that is wrong.
        </p>
      </header>

      <CompareBoard view={screen.compare} />
      <AddCard benchmarkId={benchmarkId} cards={screen.benchmark.cards.length} />

      {screen.benchmark.cards.length > 0 ? (
        <section className="mt-8 flex flex-col gap-5" aria-labelledby="cards-heading">
          <h2 id="cards-heading" className="text-lg font-medium text-ink">
            Check the cards
          </h2>
          {screen.benchmark.cards.map((card) => (
            <div key={card.id} className="flex flex-col gap-5">
              <CardReview benchmarkId={benchmarkId} card={card} />
              <ApplyPanel cardId={card.id} plan={planOf(card.id)} articles={screen.articles} chosen={asked} report={reportOf(card.id)} />
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
