import type { Metadata } from "next";
import { ImportPanel } from "@/components/brand-studio/ImportPanel";
import { PageIntro } from "@/components/shell/PageIntro";
import { PageSection } from "@/components/shell/PageSection";
import { completionView } from "@/lib/brand-studio/import";
import { PAGE_LEAD, PAGE_TITLE } from "@/lib/brand-studio/import-screen/words";
import { loadRecord } from "@/lib/brand-studio/service";
import { can, ROLE_LABELS } from "@/lib/clubs/roles";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: PAGE_TITLE };

/**
 * Phase 3 of Brand Studio: import your brand from your own site (spec F-S9; engine and view model
 * by L7, decision 0102; this screen by decision 0108).
 *
 * The server works out only what does not depend on a run: the completion % and what is still
 * missing, both from Y6's own weighting, and whether this person's role may change the brand
 * record. The run itself is a server action the panel calls, because an import takes about a minute
 * and reads a site that may refuse us -- neither of which a page render should wait on.
 */
export default async function BrandImportPage({ searchParams }: PageProps<"/brand/import">) {
  const { brand } = await requireMember();
  const record = await loadRecord(await sessionClient(), brand);
  // The address typed on the Brand page's empty state (decision 0144). Nothing runs until Read my site.
  const typed = (await searchParams).url;
  const initialUrl = typeof typed === "string" ? typed.slice(0, 2048) : "";

  return (
    <div className="flex flex-col gap-8">
      <PageIntro eyebrow={`Brand · you are ${ROLE_LABELS[brand.role].toLowerCase()}`} title={PAGE_TITLE} lead={PAGE_LEAD} />
      <PageSection id="import" title="Read one page of your site" description="Nothing is taken into your brand until you choose it, row by row.">
        <ImportPanel completion={completionView(record)} canEdit={can(brand.role, "manageKit")} initialUrl={initialUrl} />
      </PageSection>
    </div>
  );
}
