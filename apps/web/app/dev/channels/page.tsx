import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ChannelsScreen } from "@/components/channels/ChannelsScreen";
import { AppShell } from "@/components/shell/AppShell";
import { PAGE_STATES } from "@/lib/channels/fixtures/page-states";
import { outcomeOf } from "@/lib/channels/outcome";
import { devRoutesEnabled } from "../dev-routes";

export const metadata: Metadata = { title: "Sales channels screens", robots: { index: false, follow: false } };

/**
 * C4's Sales channels screen (09 screen 24, decision 0155) with made-up data, without a database: `?state=`
 * available (the prototype's p15 before connecting), connected, not-set-up, viewer or empty; `?shopify=` shows an
 * install outcome. A production build answers 404 unless DEV_UI_ROUTES is "on".
 */
export default async function DevChannelsPage({ searchParams }: PageProps<"/dev/channels">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const query = await searchParams;
  const page = PAGE_STATES[typeof query.state === "string" ? query.state : "available"] ?? PAGE_STATES.available!;
  return (
    <AppShell data={{ email: "ana@example.test", brandName: "Brand", workspace: { isClub: true, setUp: false }, credits: 1240 }}>
      <ChannelsScreen page={page} outcome={outcomeOf(query.shopify)} />
    </AppShell>
  );
}
