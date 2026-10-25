import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequestList } from "@/components/pattern-service/RequestList";
import { RequestPatternForm } from "@/components/pattern-service/RequestPatternForm";
import { listBlocks } from "@/lib/pattern-library/service";
import { eligibleForPatternService } from "@/lib/pattern-service/eligibility";
import { quoteFrom, quoteWords } from "@/lib/pattern-service/quote";
import { listForProject } from "@/lib/pattern-service/service";
import { WHAT_IS_SENT } from "@/lib/pattern-service/wording";
import { getProject } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
import { loadStored } from "@/lib/settings/store";

export const metadata: Metadata = { title: "Pattern service" };

/** A design that is missing, or belongs to another brand, is a page that does not exist. */
const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

/**
 * Asks the Sialkot team to draft a pattern for a garment Knitwright has none for (decision 0060). The price and the turnaround
 * come from the platform settings; while they are not set the page says Knitwright will confirm them, and nothing is charged.
 */
export default async function PatternServicePage({ params }: PageProps<"/studio/[projectId]/pattern-service">) {
  const { brand } = await requireMember();
  const { projectId } = await params;
  const client = await sessionClient();
  const [project, blocks, requests, stored] = await Promise.all([
    getProject(client, brand.id, projectId),
    listBlocks(client, brand.id),
    listForProject(client, brand.id, projectId),
    loadStored(adminClient()).catch(() => ({})),
  ]).catch(orNotFound);

  const eligibility = eligibleForPatternService(project.garmentType, blocks);
  const quote = quoteFrom(stored);
  const words = quoteWords(quote);
  const asked = requests.some((r) => r.designVersion === project.currentVersion);

  return (
    <main id="main" className="rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Pattern service</h1>
      <p className="mt-2 text-[15px] text-muted">
        For {project.garmentLabel}, which Knitwright cannot draft a pattern for itself. The Sialkot team drafts one and sends the files back.
      </p>
      <section aria-labelledby="what" className="mt-6">
        <h2 id="what" className="text-lg font-medium text-ink">What is sent</h2>
        <ul className="mt-2 list-disc pl-5 text-[15px] text-ink-2">
          {WHAT_IS_SENT.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="mt-3 text-[15px] text-ink-2" data-testid="pattern-price">Price: {words.price}</p>
        <p className="text-[15px] text-ink-2" data-testid="pattern-turnaround">Turnaround: {words.turnaround}</p>
      </section>
      <section aria-labelledby="ask" className="mt-6">
        <h2 id="ask" className="text-lg font-medium text-ink">Request a pattern</h2>
        {!eligibility.ok ? <p className="mt-2 text-[15px] text-muted">{eligibility.reason}</p> : asked ? (
          <p className="mt-2 text-[15px] text-muted">Version {project.currentVersion} of this design has already been sent. Save a new version to send another.</p>
        ) : (
          <div className="mt-2"><RequestPatternForm projectId={projectId} label="Request a pattern" /></div>
        )}
      </section>
      <section aria-labelledby="requests" className="mt-6">
        <h2 id="requests" className="text-lg font-medium text-ink">Your requests</h2>
        <div className="mt-2"><RequestList projectId={projectId} requests={requests} /></div>
      </section>
    </main>
  );
}
