import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GoldenSamplePanel } from "@/components/make/GoldenSamplePanel";
import { FormPage } from "@/components/shell/PageIntro";
import { can } from "@/lib/clubs/roles";
import { marketOf } from "@/lib/make/market";
import { loadMake, loadPictures, loadSampleRuns } from "@/lib/make/server";
import { AppError } from "@/lib/server/core/errors";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Golden sample" };

const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

/**
 * The golden sample of F-S7: the sample that arrived, the photos of it, what the tape and the colour reading say,
 * the founder's marks, and either a sign-off or a request for changes.
 */
export default async function GoldenSamplePage({ params, searchParams }: PageProps<"/studio/[projectId]/make/golden-sample">) {
  const member = await requireMember();
  const { projectId } = await params;
  const market = marketOf((await searchParams).market);
  const client = await sessionClient();
  const context = await loadMake(client, member.brand.id, projectId, market).catch(orNotFound);
  const [pictures, sampleRuns] = await Promise.all([loadPictures(client, member.brand.id), loadSampleRuns(client, member.brand.id, projectId)]);

  return (
    <FormPage
      eyebrow={`${context.designName} · make`}
      title="Golden sample"
      lead={
        <>
          The one garment every piece of a run is copied from. Rate the fit and the colour, record what the tape and the colour reading say, and
          sign it off -- a run needs a golden sample of the version being made.{" "}
          <Link href={`/studio/${projectId}/make` as Route} className="soft-link text-cobalt-soft">Back to the product</Link>.
        </>
      }
    >
      <GoldenSamplePanel
        context={context}
        pictures={pictures}
        samples={context.goldenSamples}
        sampleRuns={sampleRuns}
        canJudge={can(member.brand.role, "manageKit")}
      />
    </FormPage>
  );
}
