import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VIDEO_TEMPLATES, buildableNow, waitingLine } from "@/lib/media/video/social-frames";
import { getProjectAt } from "@/lib/projects/service";
import { studioHrefFor, loadDesignRows } from "@/lib/templates/feed/server";
import { sportTabsOf } from "@/lib/templates/feed/tabs";
import { previewOf, type TemplatePreview } from "@/lib/templates/preview";
import { loadSnapshots } from "@/lib/templates/service";
import { listMarketingTemplates } from "../service";
import { photoConcepts, videoConcept, type Concept } from "./concepts";

/**
 * The Marketing page's reads (decision 0140). The layouts are the marketing rows of the library,
 * read through the member's own client; the videos are `07`'s list in code, as the video studio
 * reads it.
 */

const NOT_YET = "This video cannot be made here yet.";

/** Every concept: the photo layouts, then the videos. */
export async function loadConcepts(client: SupabaseClient, latestDesignId: string | null): Promise<readonly Concept[]> {
  const layouts = await listMarketingTemplates(client);
  const studio = studioHrefFor(latestDesignId);
  return [
    ...photoConcepts(layouts),
    ...VIDEO_TEMPLATES.map((template) => videoConcept(template, studio, buildableNow(template) ? null : (waitingLine(template) ?? NOT_YET))),
  ];
}

export interface GarmentOnCards {
  readonly preview: TemplatePreview | null;
  /** The sports the Sport ▾ menu offers: those a starter design exists for. */
  readonly sports: readonly string[];
}

/**
 * The garment every card shows. With a sport chosen, the first starter design of that sport;
 * otherwise the brand's newest design, or the first starter when the brand has none yet.
 */
export async function garmentOnCards(client: SupabaseClient, brandId: string, latestDesignId: string | null, sport: string | null): Promise<GarmentOnCards> {
  const designs = await loadDesignRows(client);
  const sports = [...new Set(designs.flatMap((row) => sportTabsOf(row.sportTags, row.summary.sport)))];
  if (sport === null && latestDesignId !== null) {
    const project = await getProjectAt(client, brandId, latestDesignId).catch(() => null);
    if (project !== null) return { preview: previewOf(project.spec), sports };
  }
  const starter = designs.find((row) => sport === null || sportTabsOf(row.sportTags, row.summary.sport).some((tab) => tab === sport));
  if (starter === undefined) return { preview: null, sports };
  const snapshots = await loadSnapshots(client, [starter.summary.id]);
  return { preview: previewOf(snapshots.get(starter.summary.id)), sports };
}
