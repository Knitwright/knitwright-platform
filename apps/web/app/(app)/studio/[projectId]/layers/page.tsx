import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PanelLayersEditor } from "@/components/panel-layers/PanelLayersEditor";
import { createAssetReader } from "@/lib/artwork-intake";
import { currentStack } from "@/lib/artwork-stack";
import { assetFactsFor } from "@/lib/panel-layers/asset-facts";
import { panelLayersOn } from "@/lib/panel-layers/flag";
import { BENCHMARK_PANEL_NOTE, benchmarkPanel } from "@/lib/panel-layers/panel";
import { getProject } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Panel layers (prototype)", robots: { index: false } };

/** A design that is missing, or belongs to another brand, is a page that does not exist. */
const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

/**
 * The panel layers prototype (decision 0053). Not linked from anywhere, and a page that does not exist unless
 * NEXT_PUBLIC_PANEL_LAYERS is "on". The existing design editor is not touched.
 */
export default async function PanelLayersPage({ params }: PageProps<"/studio/[projectId]/layers">) {
  const { brand } = await requireMember();
  if (!panelLayersOn()) notFound();
  const { projectId } = await params;
  const project = await getProject(await sessionClient(), brand.id, projectId).catch(orNotFound);
  const stack = currentStack(project.spec);
  // The asset reader only answers for this brand, whatever id a stack names.
  const facts = await assetFactsFor(stack, createAssetReader(adminClient(), brand.id));

  return (
    <PanelLayersEditor
      projectId={projectId}
      designName={project.name}
      version={project.currentVersion}
      stack={stack}
      panel={benchmarkPanel()}
      facts={facts}
      panelNote={BENCHMARK_PANEL_NOTE}
    />
  );
}
