import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/server/core/errors";
import { getProject, saveActions } from "@/lib/projects/service";
import { applyKit } from "./apply-kit";
import type { ApplyKitBody } from "./schemas";
import { getKit, type Who } from "./service";

type KitUse = Readonly<{
  /** The design's version after the change; the same version when nothing needed changing. */
  version: number;
  changed: boolean;
  notes: readonly string[];
}>;

/**
 * Puts the club's colours, crest and sponsors on one design as a single saved version, so one undo
 * takes them back. The design keeps its own copy: it holds no link to the kit. The route refuses a
 * viewer before calling this, because it changes a design.
 */
export async function applyKitToDesign(
  clients: Readonly<{ client: SupabaseClient; admin: SupabaseClient }>,
  who: Who,
  body: ApplyKitBody,
): Promise<KitUse> {
  const [project, kit] = await Promise.all([getProject(clients.client, who.brandId, body.projectId), getKit(clients.client, who.brandId)]);
  const { actions, notes } = applyKit(project.spec, kit, body.parts);
  if (actions.length === 0) return { version: project.currentVersion, changed: false, notes };
  const outcome = await saveActions(clients.admin, clients.client, {
    brandId: who.brandId,
    userId: who.userId,
    projectId: body.projectId,
    expectedVersion: body.expectedVersion,
    actions,
  });
  if (!outcome.ok) throw new AppError("conflict", outcome.reason);
  return { version: outcome.version, changed: outcome.version !== body.expectedVersion, notes };
}
