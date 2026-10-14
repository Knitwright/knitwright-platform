import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BodySkeleton } from "@/components/techpack/FileSkeleton";
import { StreamedIllustrations, StreamedQuote } from "@/components/techpack/FileStreamed";
import { TechPackDocument } from "@/components/techpack/TechPackDocument";
import { TechPackEdit } from "@/components/techpack/TechPackEdit";
import { PatternSection } from "@/components/techpack/PatternSection";
import { loadDesignLeads } from "@/lib/leads/service";
import { sizeChoices } from "@/lib/patterns/request";
import { picturesNote } from "@/lib/projects/artwork-images";
import { colourwayParam } from "@/lib/projects/colour-controls";
import { buildTechPackCore, techPackPictures } from "@/lib/projects/tech-pack-data";
import { readArtworkPictures, readIllustrations, readTechPack } from "@/lib/projects/tech-pack-load";
import { AppError } from "@/lib/server/core/errors";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";

export const metadata: Metadata = { title: "Factory file" };

/** A design that is missing, or belongs to another brand, is a page that does not exist. */
const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

/** A promise the page may not reach, should it stop first. Whoever reads it still sees a failure. */
const quietly = <T,>(promise: Promise<T>): Promise<T> => {
  promise.catch(() => undefined);
  return promise;
};

/**
 * The factory file. It is made from the same reads as the export route, so the screen and the
 * files agree. The file is sent as soon as the design is read; the drawings, the illustrations and
 * the quote fill in as their slower reads finish.
 *
 * There is no loading.tsx here on purpose: one would send a 200 before the design is read, so a
 * design of another brand could no longer answer with a real 404.
 */
export default async function TechPackPage({ params, searchParams }: PageProps<"/studio/[projectId]/tech-pack">) {
  const { brand } = await requireMember();
  const { projectId } = await params;
  const search = await searchParams;
  const colourwayId = colourwayParam(search.colourway);
  const client = await sessionClient();
  const now = new Date();

  const leads = quietly(loadDesignLeads(client, brand.id, projectId, now));
  const { project, history, charts, memberNames, latest } = await readTechPack(client, brand.id, projectId).catch(orNotFound);
  const data = buildTechPackCore({ project, history, brandName: brand.name, now, colourwayId, charts, memberNames });
  const pictures = quietly(
    readArtworkPictures(client, brand.id, project.spec, { shrink: shrinkForDrawing }).then((loaded) =>
      techPackPictures(data.pack, loaded.images, picturesNote(loaded.skipped)),
    ),
  );
  const illustrations = latest ? (
    <Suspense fallback={<BodySkeleton what="the illustrations" />}>
      <StreamedIllustrations illustrations={readIllustrations(client, brand.id, latest)} currentVersion={project.currentVersion} />
    </Suspense>
  ) : null;

  return (
    <TechPackEdit projectId={data.projectId} version={data.version} spec={data.spec}>
      <TechPackDocument
        data={data}
        pictures={pictures}
        colourwayId={colourwayId}
        section={search.section}
        illustrations={illustrations}
        patterns={<PatternSection projectId={projectId} sizes={sizeChoices(project.spec)} currentVersion={project.currentVersion} />}
        quote={
          <Suspense fallback={<BodySkeleton what="the quote request" />}>
            <StreamedQuote projectId={projectId} version={project.currentVersion} leads={leads} />
          </Suspense>
        }
      />
    </TechPackEdit>
  );
}
