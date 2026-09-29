import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TechPackDocument } from "@/components/techpack/TechPackDocument";
import { TechPackEdit } from "@/components/techpack/TechPackEdit";
import { loadArtworkImages, picturesNote } from "@/lib/projects/artwork-images";
import { getProject, listVersions } from "@/lib/projects/service";
import { buildTechPackPage, printedDate } from "@/lib/projects/tech-pack-data";
import { AppError } from "@/lib/server/core/errors";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
import { createFileReader } from "@/lib/storage/read";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";

export const metadata: Metadata = { title: "Tech pack" };

/** A design that is missing, or belongs to another brand, is a page that does not exist. */
const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

export default async function TechPackPage({ params }: PageProps<"/studio/[projectId]/tech-pack">) {
  const { brand } = await requireMember();
  const { projectId } = await params;
  const client = await sessionClient();

  const [project, history] = await Promise.all([
    getProject(client, brand.id, projectId),
    listVersions(client, brand.id, projectId),
  ]).catch(orNotFound);

  const pictures = await loadArtworkImages(createFileReader(client, brand.id), shrinkForDrawing, project.spec);
  const data = buildTechPackPage({
    project,
    history,
    brandName: brand.name,
    images: pictures.images,
    printedOn: printedDate(new Date()),
    picturesNote: picturesNote(pictures.skipped),
  });

  return (
    <TechPackEdit projectId={data.projectId} version={data.version}>
      <TechPackDocument data={data} />
    </TechPackEdit>
  );
}
