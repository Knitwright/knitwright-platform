"use server";

import { z } from "zod";
import { currentVersion, listProjects, listVersions } from "@/lib/projects/project-reads";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { VERSION_STATUSES, type VersionInput, type VersionStatus } from "./versions";

/**
 * The two reads the editor's panels make when they open (plan v6 E5, decision 0149). Both read as
 * the member, so row-level security decides what is seen; neither writes. Adding a board goes
 * through the launch shell's own `saveBoardAction`, and restoring a version through the editor's
 * own `restoreVersionAction`, so no write here can differ from the one the rest of the app makes.
 */

/** How many designs the Products tab lists: the newest, which is what a person puts on a canvas. */
const DESIGNS_LISTED = 60;

export type DesignChoice = Readonly<{ id: string; name: string; garment: string; version: number }>;

/** Choose Artboard Size's Products tab: the brand's own designs. */
export const listDesignChoicesAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: z.object({}),
  handler: async ({ session }): Promise<readonly DesignChoice[]> => {
    const page = await listProjects(await sessionClient(), session.brand.id, DESIGNS_LISTED);
    return page.projects.map((one) => ({ id: one.id, name: one.name, garment: one.garmentLabel, version: one.currentVersion }));
  },
});

const statusRow = z.object({ version: z.number().int(), status: z.enum(VERSION_STATUSES) });

export type DesignHistory = Readonly<{
  current: number;
  versions: readonly VersionInput[];
  statuses: Readonly<Record<number, VersionStatus>>;
  hasMore: boolean;
}>;

/** The version history panel: a design's versions, newest first, with the gate's status on each. */
export const designHistoryAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: z.object({ projectId: z.uuid() }),
  handler: async ({ input, session }): Promise<DesignHistory> => {
    const client = await sessionClient();
    const [current, page] = await Promise.all([
      currentVersion(client, session.brand.id, input.projectId),
      listVersions(client, session.brand.id, input.projectId),
    ]);
    const { data, error } = await client.from("design_statuses").select("version, status").eq("brand_id", session.brand.id).eq("project_id", input.projectId);
    if (error) throw new AppError("internal", "The version history could not be read.", undefined, { cause: error });
    const statuses = Object.fromEntries(z.array(statusRow).parse(data ?? []).map((row) => [row.version, row.status]));
    return {
      current,
      versions: page.versions.map((one) => ({ version: one.version, note: one.note, restoredFrom: one.restoredFrom, createdAt: one.createdAt })),
      statuses,
      hasMore: page.hasMore,
    };
  },
});
