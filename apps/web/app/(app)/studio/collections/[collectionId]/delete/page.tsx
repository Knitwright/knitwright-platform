import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteForm } from "@/components/deletion/DeleteForm";
import { PageIntro } from "@/components/shell/PageIntro";
import { PageSection } from "@/components/shell/PageSection";
import { removeCollectionAction } from "@/lib/collections/actions";
import { loadPlanView } from "@/lib/collections/server";
import { pieces, styleWord } from "@/lib/collections/vocabulary";
import { can } from "@/lib/clubs/roles";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Delete collection plan" };

/**
 * Deleting a collection plan (spec F-S10). `removeCollectionAction` existed with no screen at all,
 * so a founder could plan a range and never get rid of it; this is its door, in the shape the
 * design delete page already uses: what goes, the typed word, and a way back that changes nothing.
 *
 * The designs themselves are not touched. A style card points at a design; deleting the plan takes
 * the plan, its groups, its style cards with their sizes and quantities, and any drop payload
 * waiting for the Store to collect.
 */
export default async function DeleteCollectionPage({ params }: PageProps<"/studio/collections/[collectionId]/delete">) {
  const { brand } = await requireMember();
  const { collectionId } = await params;
  const found = await loadPlanView(await sessionClient(), brand.id, collectionId);
  if (found === null) notFound();
  const { plan } = found;
  const units = plan.styles.reduce((sum, style) => sum + style.sizes.reduce((count, size) => count + size.qty, 0), 0);
  const back = `/studio/collections/${plan.id}` as Route;

  return (
    <div className="flex flex-col gap-8">
      <PageIntro eyebrow="Delete collection plan" title={plan.name} />
      <PageSection
        id="delete-collection"
        title="What this deletes"
        tone="warn"
        description={`This deletes the plan, its groups and its ${styleWord(plan.styles.length)} with their sizes and quantities (${pieces(units)} planned), and any drop payload it has written for the Store to collect. The designs behind the style cards are not touched. It cannot be undone.`}
      >
        {can(brand.role, "manageKit") ? (
          <DeleteForm action={removeCollectionAction} hidden={{ collectionId: plan.id }} submitLabel="Delete this plan" busyLabel="Deleting" />
        ) : (
          <p className="text-[15px] text-muted">Only owners, admins and kit managers can delete a collection plan.</p>
        )}
        <p className="mt-4 text-sm">
          <Link href={back} className="underline">
            Keep it and go back
          </Link>
        </p>
      </PageSection>
    </div>
  );
}
