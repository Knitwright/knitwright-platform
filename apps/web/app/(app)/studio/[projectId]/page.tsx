import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Editor } from "@/components/studio/Editor";
import { buildEditorData } from "@/lib/projects/editor-data";
import { getProject, listVersions } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Design" };

/** A design that is missing, or belongs to another brand, is a page that does not exist. */
const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

export default async function DesignPage({ params }: PageProps<"/studio/[projectId]">) {
  const { brand } = await requireMember();
  const { projectId } = await params;
  const client = await sessionClient();

  const [project, history] = await Promise.all([
    getProject(client, brand.id, projectId),
    listVersions(client, brand.id, projectId),
  ]).catch(orNotFound);

  return <Editor data={buildEditorData(project, history)} />;
}
