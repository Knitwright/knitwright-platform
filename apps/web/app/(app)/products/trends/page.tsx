import { Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CatalogueSearch } from "@/components/products/Coming";
import { IdeaTile } from "@/components/products/IdeaTile";
import { ProductsHeader } from "@/components/products/ProductsHeader";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/PageStates";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { TRENDS_PATH } from "@/lib/products/routes";
import { ideaTiles, sportChips, sportFromQuery } from "@/lib/products/trends";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
import { previewOf } from "@/lib/templates/preview";
import { loadLibrary, loadSnapshots } from "@/lib/templates/service";

export const metadata: Metadata = { title: "Trending ideas" };

/**
 * Trending ideas (plan v6 P4, decision 0142; 09 screen 26, prototype p08): sport chips and a masonry of ideas from
 * Knitwright's own template library, each opening the editor on a copy. Nothing records what is trending, so the
 * page does not claim a ranking.
 */
export default async function TrendingIdeasPage({ searchParams }: PageProps<"/products/trends">) {
  await requireMember();
  const sport = sportFromQuery((await searchParams).sport);
  const client = await sessionClient();
  const library = await loadLibrary(client);
  const tiles = ideaTiles(library, sport);
  const snapshots = await loadSnapshots(client, tiles.map((tile) => tile.id));

  return (
    <div className="flex flex-col gap-6 pb-16">
      <ProductsHeader title="Trending ideas" current={TRENDS_PATH} actions={<CatalogueSearch />} />
      <p className="text-body text-muted">Ideas from Knitwright&rsquo;s template library, by sport. Pick one to start a design on a copy of it.</p>
      <nav aria-label="Sports">
        <ul className="flex flex-wrap gap-2">
          {sportChips(library).map((chip) => (
            <li key={chip.id}>
              <Link
                href={chip.href}
                aria-current={chip.id === sport ? "true" : undefined}
                className={cx("inline-flex h-9 items-center rounded-full border px-4 text-body font-medium no-underline", chip.id === sport ? "border-navy bg-navy text-on-dark" : "border-border text-text hover:bg-soft")}
              >
                {chip.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {tiles.length === 0 ? (
        <EmptyState icon={<Icon icon={Lightbulb} size={22} />} title="No ideas for this sport yet" action={<LinkButton href={TRENDS_PATH}>Show every sport</LinkButton>}>
          The template library has no design for it yet.
        </EmptyState>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {tiles.map((tile) => (
            <IdeaTile key={tile.id} tile={tile} preview={previewOf(snapshots.get(tile.id))} />
          ))}
        </div>
      )}
    </div>
  );
}
