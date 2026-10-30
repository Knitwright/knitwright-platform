import type { Metadata } from "next";
import { Configurator } from "@/components/teamwear/Configurator";
import { getBaseArticle } from "@/lib/catalogue";
import type { PriceSource } from "@/lib/home/price";
import { marketFromQuery } from "@/lib/home/market";
import { priceBook } from "@/lib/home/reads";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
import { parsePart, parseSaved, parseSport, parseView, partsForSport, sportById } from "@/lib/teamwear";

export const metadata: Metadata = { title: "Teamwear configurator" };

/**
 * The teamwear configurator (spec F-T1): pick a sport, a part or a kit bundle, set the colours and
 * the options, see it on the 3D model and get the price.
 *
 * The page reads only what the configurator needs from the server: the base article behind each part
 * of the sport, from X1's rows, and the price ladder and smallest order for each, from X6's tiers.
 * Everything a person then changes stays in the browser until Save, so no colour tap makes a design
 * version. A failed read of either never stops the page opening: the article is then absent and the
 * part says so, and the price reads "not priced yet", which is the truth about what could be read.
 */
export default async function TeamwearPage({ searchParams }: PageProps<"/teamwear">) {
  const { brand } = await requireMember();
  const query = await searchParams;
  const sportId = parseSport(query);
  const market = marketFromQuery(query.market);
  const client = await sessionClient();

  const parts = partsForSport(sportById(sportId));
  const codes = [...new Set(parts.flatMap((part) => (part.articleCode === null ? [] : [part.articleCode])))];
  const [book, read] = await Promise.all([
    priceBook(),
    Promise.all(codes.map((code) => getBaseArticle(client, code).catch(() => null))),
  ]);

  const articles = read.filter((article): article is NonNullable<typeof article> => article !== null);
  const sources: Record<string, PriceSource> = Object.fromEntries(codes.map((code) => [code, book.source(code)]));

  return (
    <Configurator
      sportId={sportId}
      part={parsePart(query, sportId)}
      view={parseView(query.view)}
      saved={parseSaved(query)}
      articles={articles}
      sources={sources}
      currency={market.currency}
      factoryName={book.factoryName}
      brandName={brand.name}
    />
  );
}
