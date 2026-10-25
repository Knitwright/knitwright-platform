import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewSubmissionForm } from "@/components/designers/DesignerForms";
import { PageIntro } from "@/components/shell/PageIntro";
import { loadDesignChoices, loadProfile } from "@/lib/designers/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Offer a design" };

/** Offer one of your designs as a template. It starts as a draft; the rights statement is made when you send it. */
export default async function NewSubmissionPage() {
  const { userId, brand } = await requireMember();
  const client = await sessionClient();
  if (!(await loadProfile(client, userId))) redirect("/designer");
  const designs = await loadDesignChoices(client, brand.id);
  return (
    <div className="flex flex-col gap-5">
      <PageIntro eyebrow={brand.name} title="Offer a design" lead="Choose a design and describe it. Knitwright reviews it before it appears in the template library." />
      <NewSubmissionForm designs={designs} />
    </div>
  );
}
