import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteForm } from "@/components/deletion/DeleteForm";
import { PageIntro } from "@/components/shell/PageIntro";
import { PageSection } from "@/components/shell/PageSection";
import { deleteDesignAction } from "@/lib/deletion/actions";
import { getProject } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Delete design" };

/** A design that is missing, or belongs to another brand, is a page that does not exist. */
const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

export default async function DeleteDesignPage({ params }: PageProps<"/studio/[projectId]/delete">) {
  const { brand } = await requireMember();
  const { projectId } = await params;
  const project = await getProject(await sessionClient(), brand.id, projectId).catch(orNotFound);

  return (
    <div className="flex flex-col gap-8">
      <PageIntro eyebrow="Delete design" title={project.name} />
      <PageSection
        id="delete-design"
        title="What this deletes"
        tone="warn"
        description="This deletes the design, every saved version of it, its download records, and the uploaded pictures that no other design uses. It cannot be undone."
      >
        <DeleteForm
          action={deleteDesignAction}
          hidden={{ projectId }}
          submitLabel="Delete this design"
          busyLabel="Deleting"
        />
        <p className="mt-4 text-sm">
          <Link href={`/studio/${projectId}`} className="underline">
            Keep it and go back
          </Link>
        </p>
      </PageSection>
    </div>
  );
}
