import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MakeSummary } from "@/components/make/MakeSummary";
import { NextSteps } from "@/components/make/NextSteps";
import { PageIntro } from "@/components/shell/PageIntro";
import { loadHero, loadMake } from "@/lib/make/server";
import { AppError } from "@/lib/server/core/errors";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
import { marketOf } from "@/lib/make/market";

export const metadata: Metadata = { title: "Make" };

/** A design that is missing, or belongs to another brand, is a page that does not exist. */
const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

/**
 * "Product created" (F-S7): what the product is, what a piece costs at 1, 50 and 100 pieces, when it could be
 * delivered, the picture, and the four next steps.
 *
 * Nothing on this page takes money. Where the spec ends a step in paying, this page shows the price and the date
 * and hands the order over to production instead (owner decision 1).
 */
export default async function MakePage({ params, searchParams }: PageProps<"/studio/[projectId]/make">) {
  const { brand } = await requireMember();
  const { projectId } = await params;
  const market = marketOf((await searchParams).market);
  const client = await sessionClient();
  const context = await loadMake(client, brand.id, projectId, market).catch(orNotFound);
  const signedOff = context.goldenSamples.find((one) => one.state === "approved");
  const hero = await loadHero(client, brand.id, projectId, signedOff?.photos[0]?.fileId ?? null);

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow={`${brand.name} · make`}
        title="Product created"
        lead="Your design is ready to be made. Order a sample, judge it, and once you have signed it off you can order a run. Knitwright invoices an order outside this platform: nothing here takes a payment."
      />
      <MakeSummary context={context} hero={hero} />
      <NextSteps projectId={projectId} gate={context.gate} hasProduct={context.product !== null} />
    </div>
  );
}
