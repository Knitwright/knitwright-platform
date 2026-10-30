import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SampleForm } from "@/components/make/SampleForm";
import { FormPage } from "@/components/shell/PageIntro";
import { can } from "@/lib/clubs/roles";
import { marketOf } from "@/lib/make/market";
import { loadMake } from "@/lib/make/server";
import { AppError } from "@/lib/server/core/errors";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Order a sample" };

const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

/** The sample request of F-S7: one piece per size, at most three sizes, with the price and the date shown first. */
export default async function SamplePage({ params, searchParams }: PageProps<"/studio/[projectId]/make/sample">) {
  const member = await requireMember();
  const { projectId } = await params;
  const market = marketOf((await searchParams).market);
  const client = await sessionClient();
  const context = await loadMake(client, member.brand.id, projectId, market).catch(orNotFound);

  return (
    <FormPage
      eyebrow={`${context.designName} · make`}
      title="Order a sample"
      lead={
        <>
          One piece of each size you choose, made in the next slot. You see the price and the delivery date before anything is sent; Knitwright
          invoices it outside this platform. <Link href={`/studio/${projectId}/make` as Route} className="soft-link text-cobalt-soft">Back to the product</Link>.
        </>
      }
    >
      <SampleForm context={context} canOrder={can(member.brand.role, "manageKit")} />
    </FormPage>
  );
}
