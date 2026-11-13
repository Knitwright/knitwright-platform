import { notFound } from "next/navigation";
import { DesignImportPanel } from "@/components/design-import/DesignImportPanel";
import { KitStylesLink } from "@/components/kit-styles/KitStylesLink";
import { OrganisationPrompt } from "@/components/leads/OrganisationPrompt";
import { QuoteRequest } from "@/components/leads/QuoteRequest";
import { ShareSection } from "@/components/share/ShareSection";
import { PhotorealPanel } from "@/components/studio/PhotorealPanel";
import { baseArticleForType, getBaseArticle } from "@/lib/catalogue";
import { brandChartSet } from "@/lib/charts/service";
import { getEnv } from "@/lib/config/env";
import { designImportEnabled } from "@/lib/design-import/switch";
import { editorPageState } from "@/lib/editor";
import { loadIllustrations } from "@/lib/images/illustrations";
import { latestImages } from "@/lib/images/service";
import { countryOptions } from "@/lib/leads/organisation";
import { loadDesignLeads } from "@/lib/leads/service";
import { loadArtworkImages } from "@/lib/projects/artwork-images";
import { assistantAvailable } from "@/lib/projects/assistant";
import { conversationFor } from "@/lib/projects/chat-history";
import { colourwayParam } from "@/lib/projects/colour-controls";
import { buildEditorData } from "@/lib/projects/editor-data";
import { getProject, listVersions } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { imageProvider, sessionClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import { createFileReader } from "@/lib/storage/read";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";
import { readValidationResults } from "@/lib/validation/results";
import { EditorShell } from "./EditorShell";

/**
 * The design editor for one garment, read on the server (moved here from the old
 * `/studio/[projectId]` page by plan v6 E1, decision 0145). The one canvas opens it in place when a
 * Garment board is focused; nothing about how a design is read, edited, saved or validated changed
 * in the move -- every write still goes through the editor's own actions and `lib/validation`.
 */

type Query = Readonly<Record<string, string | string[] | undefined>>;

/** A design that is missing, or belongs to another brand, is a page that does not exist. */
const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

export async function GarmentEditor({ brandId, projectId, query }: Readonly<{ brandId: string; projectId: string; query: Query }>) {
  const colourway = colourwayParam(query.colourway);
  const client = await sessionClient();

  const [project, history, charts] = await Promise.all([
    getProject(client, brandId, projectId),
    listVersions(client, brandId, projectId),
    brandChartSet(client, brandId),
  ]).catch(orNotFound);

  const reader = createFileReader(client, brandId);
  const articleCode = project.spec.article?.baseArticleCode ?? baseArticleForType(project.spec.typeId) ?? null;
  const [pictures, illustrations, leads, conversation, article, results] = await Promise.all([
    loadArtworkImages(reader, shrinkForDrawing, project.spec),
    latestImages(client, brandId, projectId).then((latest) => loadIllustrations(reader, latest)),
    loadDesignLeads(client, brandId, projectId, new Date()),
    conversationFor(client, { brandId, projectId }, log),
    // A catalogue the design cannot be read against must not stop the editor opening.
    articleCode ? getBaseArticle(client, articleCode).catch(() => null) : Promise.resolve(null),
    readValidationResults(client, brandId, projectId, project.currentVersion).catch(() => []),
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
        share: <ShareSection brandId={brandId} projectId={projectId} currentVersion={project.currentVersion} />,
        quote: <QuoteRequest projectId={projectId} version={project.currentVersion} firstDate={leads.firstDate} earlier={leads.quotes} />,
        organisation: leads.askDetails ? <OrganisationPrompt details={leads.details} countries={countryOptions()} /> : null,
        // Decision 0038 item 7: with the switch off the routes answer 404, so no door is drawn.
        designImport: designImportEnabled() ? <DesignImportPanel /> : null,
      }}
    />
  );
}
