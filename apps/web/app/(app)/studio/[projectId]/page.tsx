import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignLeads } from "@/components/leads/DesignLeads";
import { Editor } from "@/components/studio/Editor";
import { PhotorealPanel } from "@/components/studio/PhotorealPanel";
import { ShareSection } from "@/components/share/ShareSection";
import { brandChartSet } from "@/lib/charts/service";
import { getEnv } from "@/lib/config/env";
import { loadIllustrations } from "@/lib/images/illustrations";
import { loadDesignLeads } from "@/lib/leads/service";
import { latestImages } from "@/lib/images/service";
import { colourwayParam } from "@/lib/projects/colour-controls";
import { loadArtworkImages } from "@/lib/projects/artwork-images";
import { assistantAvailable } from "@/lib/projects/assistant";
import { conversationFor } from "@/lib/projects/chat-history";
import { buildEditorData } from "@/lib/projects/editor-data";
import { getProject, listVersions } from "@/lib/projects/service";
import { KitStylesLink } from "@/components/kit-styles/KitStylesLink";
import { AppError } from "@/lib/server/core/errors";
import { imageProvider, sessionClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import { requireMember } from "@/lib/server/page-guards";
import { createFileReader } from "@/lib/storage/read";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";

export const metadata: Metadata = { title: "Design" };

/** A design that is missing, or belongs to another brand, is a page that does not exist. */
const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

export default async function DesignPage({ params, searchParams }: PageProps<"/studio/[projectId]">) {
  const { brand } = await requireMember();
  const { projectId } = await params;
  const colourway = colourwayParam((await searchParams).colourway);
  const client = await sessionClient();

  const [project, history, charts] = await Promise.all([
    getProject(client, brand.id, projectId),
    listVersions(client, brand.id, projectId),
    brandChartSet(client, brand.id),
  ]).catch(orNotFound);

  const reader = createFileReader(client, brand.id);
  const [pictures, illustrations, leads, conversation] = await Promise.all([
    loadArtworkImages(reader, shrinkForDrawing, project.spec),
    latestImages(client, brand.id, projectId).then((latest) => loadIllustrations(reader, latest)),
    loadDesignLeads(client, brand.id, projectId, new Date()),
    conversationFor(client, { brandId: brand.id, projectId }, log),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <KitStylesLink projectId={projectId} typeId={project.spec.typeId} from="editor" />
      <Editor
        data={buildEditorData(project, history, charts, pictures, colourway)}
        assistant={{ available: assistantAvailable(), conversation }}
        show3d={getEnv().SHOW_3D}
      />
      <PhotorealPanel
        projectId={projectId}
        available={imageProvider() !== null}
        colourwayId={colourway}
        currentVersion={project.currentVersion}
        loaded={illustrations}
      />
      <DesignLeads projectId={projectId} version={project.currentVersion} data={leads} withPrompt />
      <ShareSection brandId={brand.id} projectId={projectId} currentVersion={project.currentVersion} />
    </div>
  );
}
