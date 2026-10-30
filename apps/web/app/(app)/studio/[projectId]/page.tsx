import { countryOptions } from "@/lib/leads/organisation";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrganisationPrompt } from "@/components/leads/OrganisationPrompt";
import { QuoteRequest } from "@/components/leads/QuoteRequest";
import { EditorShell } from "@/components/studio/editor/EditorShell";
import { PhotorealPanel } from "@/components/studio/PhotorealPanel";
import { ShareSection } from "@/components/share/ShareSection";
import { baseArticleForType, getBaseArticle } from "@/lib/catalogue";
import { brandChartSet } from "@/lib/charts/service";
import { getEnv } from "@/lib/config/env";
import { editorPageState } from "@/lib/editor";
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
import { readValidationResults } from "@/lib/validation/results";

export const metadata: Metadata = { title: "Design" };

/** A design that is missing, or belongs to another brand, is a page that does not exist. */
const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

export default async function DesignPage({ params, searchParams }: PageProps<"/studio/[projectId]">) {
  const { brand } = await requireMember();
  const { projectId } = await params;
  const query = await searchParams;
  const colourway = colourwayParam(query.colourway);
  const client = await sessionClient();

  const [project, history, charts] = await Promise.all([
    getProject(client, brand.id, projectId),
    listVersions(client, brand.id, projectId),
    brandChartSet(client, brand.id),
  ]).catch(orNotFound);

  const reader = createFileReader(client, brand.id);
  const articleCode = project.spec.article?.baseArticleCode ?? baseArticleForType(project.spec.typeId) ?? null;
  const [pictures, illustrations, leads, conversation, article, results] = await Promise.all([
    loadArtworkImages(reader, shrinkForDrawing, project.spec),
    latestImages(client, brand.id, projectId).then((latest) => loadIllustrations(reader, latest)),
    loadDesignLeads(client, brand.id, projectId, new Date()),
    conversationFor(client, { brandId: brand.id, projectId }, log),
    // A catalogue the design cannot be read against must not stop the editor opening.
    articleCode ? getBaseArticle(client, articleCode).catch(() => null) : Promise.resolve(null),
    readValidationResults(client, brand.id, projectId, project.currentVersion).catch(() => []),
  ]);

  const state = editorPageState({ query, article, sizing: project.spec.sizing });

  return (
    <EditorShell
      data={buildEditorData(project, history, charts, pictures, colourway)}
      assistant={{ available: assistantAvailable(), conversation }}
      show3d={getEnv().SHOW_3D}
      article={article}
      segment={state.segment}
      view={state.view}
      beside={state.beside}
      size={state.size}
      sizes={state.sizes}
      form={state.form}
      draft={state.draft}
      model={state.model}
      checks={results[0]?.checks ?? []}
      slots={{
        kitStyles: <KitStylesLink projectId={projectId} typeId={project.spec.typeId} from="editor" />,
        photoreal: (
          <PhotorealPanel
            projectId={projectId}
            available={imageProvider() !== null}
            colourwayId={colourway}
            currentVersion={project.currentVersion}
            loaded={illustrations}
          />
        ),
        share: <ShareSection brandId={brand.id} projectId={projectId} currentVersion={project.currentVersion} />,
        quote: <QuoteRequest projectId={projectId} version={project.currentVersion} firstDate={leads.firstDate} earlier={leads.quotes} />,
        organisation: leads.askDetails ? <OrganisationPrompt details={leads.details} countries={countryOptions()} /> : null,
      }}
    />
  );
}
