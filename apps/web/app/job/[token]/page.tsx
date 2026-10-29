import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { FactoryControls } from "@/components/job-packet/FactoryControls";
import { History, MaterialsList, NamesList, OrderList, SizeBreakdown } from "@/components/job-packet/PacketLists";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { pageFrame } from "@/components/shell/page-width";
import { historyLines, loadPacketPage } from "@/lib/job-packet/load";
import { packetLoadDeps } from "@/lib/job-packet/server";
import { formatDateTime } from "@/lib/projects/dates";
import { productionDeps } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

/**
 * A factory's job packet (decision 0072, spec F-O2). Anyone holding the link sees one batch, with no account, so
 * the page is never indexed, never cached and never sends its address on (next.config.ts sets the headers). An
 * unknown, expired or revoked link is the ordinary page that does not exist, with nothing to tell the three apart.
 */
export const metadata: Metadata = {
  title: "Job packet",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default async function JobPacketPage({ params }: PageProps<"/job/[token]">) {
  await connection();
  const address = await productionDeps.getClientAddress();
  const allowed = await productionDeps.hitRateLimit(`${LIMITS.jobPacketView.name}:address:${address}`, LIMITS.jobPacketView);
  const { token } = await params;
  const loaded = allowed ? await loadPacketPage(packetLoadDeps(), token) : null;
  if (allowed && !loaded) notFound();

  return (
    <>
      <PublicHeader linkHome={false} />
      <main id="main" className={`rise ${pageFrame("content")} flex flex-col gap-10 py-10`}>
        {loaded ? (
          <>
            <header className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">Job packet: {loaded.batch.articleId}</h1>
              <p className="text-[15px] text-ink-2">{loaded.sheet.subtitle}</p>
              <p className="text-lg font-medium text-ink" data-testid="job-due">Due date: {loaded.sheet.dueDate}</p>
              {loaded.sheet.dueNote ? <p className="text-sm text-muted">{loaded.sheet.dueNote}</p> : null}
              <p className="text-sm text-faint">This link works until {formatDateTime(loaded.packet.expiresAt)}. Do not share it outside your factory.</p>
              {loaded.sheet.warnings.map((w) => <p key={w} role="alert" className="text-sm text-warn">{w}</p>)}
            </header>
            <section aria-labelledby="job-files" className="flex flex-col gap-2">
              <h2 id="job-files" className="text-lg font-semibold text-ink">Files</h2>
              <p className="flex flex-wrap gap-4 text-sm">
                <a href={`/api/job/${token}/sheet`} className="font-medium underline" download rel="noreferrer">Job sheet (PDF)</a>
                <a href={`/api/job/${token}/files`} className="font-medium underline" download rel="noreferrer">All files (ZIP: job sheet, print files, patterns)</a>
              </p>
            </section>
            <FactoryControls token={token} next={loaded.nextStep} />
            <OrderList sheet={loaded.sheet} />
            <SizeBreakdown sheet={loaded.sheet} />
            <NamesList sheet={loaded.sheet} />
            <MaterialsList sheet={loaded.sheet} />
            <History lines={historyLines(loaded.events)} />
          </>
        ) : (
          <p role="alert" className="text-[15px] text-ink-2">Too many requests from your network. Wait a minute, then reload the page.</p>
        )}
      </main>
    </>
  );
}
