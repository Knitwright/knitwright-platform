import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { MarketingView } from "@/components/marketing/v3/MarketingView";
import { MockupsView } from "@/components/mockups/v3/MockupsView";
import { AppShell } from "@/components/shell/AppShell";
import { TemplatesView } from "@/components/templates/v3/TemplatesView";
import { tabFromQuery } from "@/lib/templates/feed/tabs";
import { devRoutesEnabled } from "../dev-routes";
import { marketingFixture, mockupsFixture, templatesFixture } from "./fixtures";

export const metadata: Metadata = {
  title: "Dashboard pages",
  robots: { index: false, follow: false },
};

/**
 * The Templates, Mockups and Marketing pages with made-up data (decision 0140), for the 1440 × 900
 * comparisons with d13, d14 and d15. It reads nothing and needs no session; a production build
 * answers 404 unless DEV_UI_ROUTES is "on". `?screen=templates|mockups|marketing`, and on templates
 * `&tab=` any tab. The buttons are drawn but go nowhere useful without a session.
 */
export default async function DevPagesPage({ searchParams }: PageProps<"/dev/pages">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const query = await searchParams;
  const screen = query.screen;
  return (
    <AppShell data={{ email: "ana@example.test", brandName: "Northfield FC", workspace: { isClub: false, setUp: false }, credits: 1240 }}>
      {screen === "mockups" ? <MockupsView {...mockupsFixture()} /> : screen === "marketing" ? <MarketingView {...marketingFixture()} /> : <TemplatesView {...templatesFixture(tabFromQuery(query.tab))} />}
    </AppShell>
  );
}
