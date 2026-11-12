import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ProductsSkeleton } from "@/components/products/ProductsSkeleton";
import { AppShell } from "@/components/shell/AppShell";
import { devRoutesEnabled } from "../dev-routes";
import { CategoryView, HomeView, MineView, ProductView, TrendsView } from "./views";

export const metadata: Metadata = {
  title: "Products fixture",
  robots: { index: false, follow: false },
};

/**
 * The Products pages with fixture data (plan v6 P4, decision 0142), for the 1440 × 900 comparison with the
 * prototype renders p01, p02, p03, p04, p05 and p08 without a database. `?view=` picks one: home (default),
 * category, product, configurator, mine, mine-empty, trends, loading. It reads no database and needs no session;
 * a production build answers 404 unless DEV_UI_ROUTES is "on".
 */
export default async function DevProductsPage({ searchParams }: PageProps<"/dev/products">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const view = (await searchParams).view;
  return (
    <AppShell data={{ email: "ana@example.test", brandName: "Northfield FC", workspace: { isClub: true, setUp: true }, credits: 1240 }}>
      <Body view={typeof view === "string" ? view : "home"} />
    </AppShell>
  );
}

function Body({ view }: Readonly<{ view: string }>) {
  switch (view) {
    case "category":
      return <CategoryView />;
    case "product":
    case "configurator":
      return <ProductView open={view === "configurator"} />;
    case "mine":
    case "mine-empty":
      return <MineView empty={view === "mine-empty"} />;
    case "trends":
      return <TrendsView />;
    case "loading":
      return <ProductsSkeleton label="Loading products" />;
    default:
      return <HomeView />;
  }
}
