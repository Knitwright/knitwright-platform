import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { pageFrame } from "@/components/shell/page-width";
import { Notice } from "@/components/ui/Notice";
import { adminClient, productionDeps } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { readBuyerPayment, readPublicStore } from "@/lib/team-stores/reads";
import { buyerOutcome } from "@/lib/team-stores/receipt";
import { isStoreCode } from "@/lib/team-stores/rules";

/**
 * Where a team store buyer comes back to from the checkout (plan v6 C2, decision 0153). It reads only that one
 * payment of that one store, by the ids the checkout carried, and says whether it is paid, still being confirmed,
 * cancelled or refunded. It shows no name, email or shirt name.
 */
export const metadata: Metadata = {
  title: "Your team store order",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default async function TeamStoreDonePage({ params, searchParams }: PageProps<"/t/[code]/done">) {
  await connection();
  const address = await productionDeps.getClientAddress();
  if (!(await productionDeps.hitRateLimit(`${LIMITS.teamStoreView.name}:address:${address}`, LIMITS.teamStoreView))) notFound();
  const { code } = await params;
  const query = await searchParams;
  const paymentId = typeof query.payment === "string" ? query.payment : "";
  const loaded = isStoreCode(code) ? await readPublicStore(adminClient(), code) : null;
  const payment = loaded ? await readBuyerPayment(adminClient(), loaded.store.id, paymentId) : null;
  if (!loaded || !payment) notFound();
  const outcome = buyerOutcome(payment, query.cancelled === "1", loaded.store);

  return (
    <>
      <PublicHeader linkHome={false} width="form" />
      <main id="main" className={`rise ${pageFrame("form")} flex flex-col gap-6 py-10`}>
        <p className="text-small text-muted">
          {loaded.club.name} · {loaded.store.title}
        </p>
        <h1 className="text-h1 text-text" data-testid="team-store-outcome">
          {outcome.title}
        </h1>
        <Notice tone={outcome.tone}>{outcome.body}</Notice>
        <Link href={`/t/${code}` as `/t/${string}`} className="text-small font-semibold text-link live:hover:underline">
          Back to the store
        </Link>
      </main>
    </>
  );
}
