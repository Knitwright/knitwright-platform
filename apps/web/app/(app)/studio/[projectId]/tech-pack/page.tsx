import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TechPackDocument } from "@/components/techpack/TechPackDocument";
import { TechPackEdit } from "@/components/techpack/TechPackEdit";
import { picturesNote } from "@/lib/projects/artwork-images";
import { colourwayParam } from "@/lib/projects/colour-controls";
import { buildTechPackPage } from "@/lib/projects/tech-pack-data";
import { loadTechPackSource } from "@/lib/projects/tech-pack-load";
import { AppError } from "@/lib/server/core/errors";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
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

  // The same loader the export route uses, so the screen and the files are made from the same reads.
  const { project, history, pictures } = await loadTechPackSource(client, brand.id, projectId, { shrink: shrinkForDrawing }).catch(orNotFound);
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
      <TechPackDocument data={data} colourwayId={colourwayId} />
    </TechPackEdit>
  );
}
