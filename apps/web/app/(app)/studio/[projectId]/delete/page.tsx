import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteForm } from "@/components/deletion/DeleteForm";
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
    <div className="flex max-w-2xl flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wider text-muted">Delete design</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{project.name}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          This deletes the design, every saved version of it, its download records, and the
          uploaded pictures that no other design uses. It cannot be undone.
        </p>
      </header>
      <section className="rounded-2xl border border-hairline bg-surface p-6">
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
      </section>
    </div>
  );
}
