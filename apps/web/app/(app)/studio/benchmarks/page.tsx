import type { Metadata } from "next";
import Link from "next/link";
import { NewBenchmark } from "@/components/benchmarks/NewBenchmark";
import { benchmarkStore } from "@/lib/benchmarks/server";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Benchmarks" };

/**
 * The brand's comparisons (spec F-S2). A comparison is a comparison and never a copy: the page says so here, where a
 * person starts one, rather than only in the small print of a card.
 */
export default async function BenchmarksPage() {
  const { brand, userId } = await requireMember();
  const store = await benchmarkStore();
  const benchmarks = await store.list({ brandId: brand.id, userId });

  return (
    <>
      <header>
        <p className="font-mono text-xs uppercase tracking-wider text-muted">{brand.name}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Benchmarks</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          See what comparable products are made of and what customers complain about. Paste up to five product links, or
          paste review text. We read a page once, logged out, and only if the site&rsquo;s robots.txt allows it; we keep
          the facts and the link, never the page. Logos, brand names and prints are never carried onto your design.
        </p>
      </header>

      {benchmarks.length === 0 ? (
        <p className="mt-8 text-[15px] text-muted">{brand.name} has no benchmarks yet.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {benchmarks.map((benchmark) => (
            <li key={benchmark.id} className="rounded-2xl border border-hairline bg-surface p-5">
              <Link href={`/studio/benchmarks/${benchmark.id}`} className="text-[15px] font-medium text-ink no-underline">
                {benchmark.title}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {benchmark.cards === 1 ? "1 product" : `${benchmark.cards} products`}
                {benchmark.projectId === null ? "" : " · tied to a design"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <NewBenchmark />
    </>
  );
}
