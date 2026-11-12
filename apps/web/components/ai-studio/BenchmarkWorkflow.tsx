import Link from "next/link";
import type { Route } from "next";
import { NewBenchmark } from "@/components/benchmarks/NewBenchmark";
import type { BenchmarkSummary } from "@/lib/benchmarks/store";

/**
 * Benchmark products (spec F-S2), moved from `/studio/benchmarks` into its workflow page (decision
 * 0141) with its behaviour unchanged: the brand's comparisons, then "New benchmark". A comparison is
 * a comparison and never a copy, and the page says so where a person starts one.
 */

type Props = Readonly<{ brandName: string; benchmarks: readonly BenchmarkSummary[] }>;

export function BenchmarkWorkflow({ brandName, benchmarks }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-body text-muted">
        Paste up to five product links, or paste review text. We read a page once, logged out, and only if the site&rsquo;s robots.txt allows it; we keep the facts and the link, never the page. Logos,
        brand names and prints are never carried onto your design.
      </p>
      {benchmarks.length === 0 ? (
        <p className="text-body-lg text-muted">{brandName} has no benchmarks yet. Name what you are comparing below to make the first one.</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Your benchmarks">
          {benchmarks.map((benchmark) => (
            <li key={benchmark.id} className="rounded-xl border border-border bg-bg p-5">
              <Link href={`/studio/benchmarks/${benchmark.id}` as Route} className="text-title text-text no-underline live:hover:underline">
                {benchmark.title}
              </Link>
              <p className="mt-1 text-small text-muted">
                {benchmark.cards === 1 ? "1 product" : `${benchmark.cards} products`}
                {benchmark.projectId === null ? "" : " · tied to a design"}
              </p>
            </li>
          ))}
        </ul>
      )}
      <NewBenchmark />
    </div>
  );
}
