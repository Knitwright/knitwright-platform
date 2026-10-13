import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuidedFlow } from "@/components/guided/GuidedFlow";
import { brandChartSet } from "@/lib/charts/service";
import { getEnv } from "@/lib/config/env";
import { startMethodFrom, stepFrom } from "@/lib/guided/flow";
import { loadArtworkImages } from "@/lib/projects/artwork-images";
import { assistantAvailable } from "@/lib/projects/assistant";
import { conversationFor } from "@/lib/projects/chat-history";
import { buildEditorData } from "@/lib/projects/editor-data";
import { getProject, listVersions } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { sessionClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import { requireMember } from "@/lib/server/page-guards";
import { createFileReader } from "@/lib/storage/read";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";
import { lengthUnitFrom } from "@/lib/units/length";

export const metadata: Metadata = { title: "Guided design" };

/** A design that is missing, or belongs to another brand, is a page that does not exist. */
const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

/** Plan step 15: one path from start to download, with the drawing and measurements always in view. */
export default async function GuidePage({ params, searchParams }: PageProps<"/studio/[projectId]/guide">) {
  const { brand } = await requireMember();
  const { projectId } = await params;
  const query = await searchParams;
  const client = await sessionClient();

  const [project, history, charts] = await Promise.all([
    getProject(client, brand.id, projectId),
    listVersions(client, brand.id, projectId),
    brandChartSet(client, brand.id),
  ]).catch(orNotFound);
  const [pictures, conversation] = await Promise.all([
    loadArtworkImages(createFileReader(client, brand.id), shrinkForDrawing, project.spec),
    conversationFor(client, { brandId: brand.id, projectId }, log),
  ]);
  const say = typeof query.say === "string" ? query.say : undefined;

  return (
    <GuidedFlow
      data={buildEditorData(project, history, charts, pictures)}
      step={stepFrom(query.step)}
      from={startMethodFrom(query.from)}
      say={say}
      unit={lengthUnitFrom(query.unit)}
      assistant={{ available: assistantAvailable(), conversation }}
      show3d={getEnv().SHOW_3D}
    />
  );
}
