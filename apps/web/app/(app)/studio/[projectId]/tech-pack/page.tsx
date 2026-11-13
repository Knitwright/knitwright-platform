import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BodySkeleton } from "@/components/techpack/FileSkeleton";
import { StreamedIllustrations, StreamedQuote } from "@/components/techpack/FileStreamed";
import { TechPackDocument } from "@/components/techpack/TechPackDocument";
import { TechPackEdit } from "@/components/techpack/TechPackEdit";
import { PatternServiceLink } from "@/components/pattern-service/PatternServiceLink";
import { PatternSection } from "@/components/techpack/PatternSection";
import { TechPackEditorOnPage } from "@/components/techpack-editor/OnPage";
import { baseArticleForType, getBaseArticle } from "@/lib/catalogue";
import { getEnv } from "@/lib/config/env";
import { editorAddress, headerOfDesign, sheetDate } from "@/lib/techpack/editor/from-project";
import { canExportTechPacks, sheetsDownloads } from "@/lib/techpack/editor/plan";
import { editorTabOr } from "@/lib/techpack/editor/tabs";
import { loadDesignLeads } from "@/lib/leads/service";
import { slotFor } from "@/lib/pattern-library/slots";
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
  const { project, history, charts, memberNames, production, latest } = await readTechPack(client, brand.id, projectId).catch(orNotFound);
  const data = buildTechPackCore({ project, history, brandName: brand.name, now, colourwayId, charts, memberNames, production });
  // The v3.9 editor reads the base article the design sits on (decision 0151). One that cannot be
  // read leaves the editor saying the design is not on one, and never stops the factory file.
  const articleCode = baseArticleForType(project.garmentType) ?? null;
  const article = articleCode === null ? null : await getBaseArticle(client, articleCode).catch(() => null);
  const editor = (
    <TechPackEditorOnPage
      article={article}
      header={headerOfDesign(project, brand.name)}
      tab={editorTabOr(typeof search.tab === "string" ? search.tab : null)}
      {...(colourwayId === undefined ? {} : { colourwayId })}
      sheets={{
        date: sheetDate(now),
        openIn: editorAddress(getEnv().NEXT_PUBLIC_SITE_URL, projectId),
        downloads: sheetsDownloads(projectId),
        canExport: canExportTechPacks(),
      }}
    />
  );
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
        editor={editor}
        patterns={
          <>
            <PatternSection projectId={projectId} sizes={sizeChoices(project.spec)} currentVersion={project.currentVersion} />
            {slotFor(project.garmentType)?.needsDraft ? <PatternServiceLink projectId={projectId} /> : null}
          </>
        }
        quote={
          <Suspense fallback={<BodySkeleton what="the quote request" />}>
            <StreamedQuote projectId={projectId} version={project.currentVersion} leads={leads} />
          </Suspense>
        }
      />
    </TechPackEdit>
  );
}
