import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TechPackDocument } from "@/components/techpack/TechPackDocument";
import { TechPackEdit } from "@/components/techpack/TechPackEdit";
import { loadArtworkImages, picturesNote } from "@/lib/projects/artwork-images";
import { colourwayParam } from "@/lib/projects/colour-controls";
import { getProject, listVersions } from "@/lib/projects/service";
import { buildTechPackPage, historyIsNewer } from "@/lib/projects/tech-pack-data";
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

export default async function TechPackPage({ params, searchParams }: PageProps<"/studio/[projectId]/tech-pack">) {
  const { brand } = await requireMember();
  const { projectId } = await params;
  const colourwayId = colourwayParam((await searchParams).colourway);
  const client = await sessionClient();

  const read = () =>
    Promise.all([getProject(client, brand.id, projectId), listVersions(client, brand.id, projectId)]).catch(orNotFound);
  let [project, history] = await read();
  // A save that landed between the two reads leaves the history ahead of the design. Read again once.
  if (historyIsNewer(project, history)) [project, history] = await read();

  const pictures = await loadArtworkImages(createFileReader(client, brand.id), shrinkForDrawing, project.spec);
  const data = buildTechPackPage({
    project,
    history,
    brandName: brand.name,
    images: pictures.images,
    now: new Date(),
    picturesNote: picturesNote(pictures.skipped),
    colourwayId,
  });

  return (
    <TechPackEdit projectId={data.projectId} version={data.version}>
      <TechPackDocument data={data} />
    </TechPackEdit>
  );
}
