"use server";

import { revalidatePath } from "next/cache";
import { brandChartSet } from "@/lib/charts/service";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { launchProjectPath } from "@/lib/launch";
import { loadLaunchProject, recordOutput, saveBoard, type Who } from "@/lib/launch/service";
import { loadArtworkImages } from "@/lib/projects/artwork-images";
import { getProjectAt } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { createFileReader } from "@/lib/storage/read";
import { storeImage } from "@/lib/storage/store";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";
import { renderMockupBoardBody } from "./schemas";
import { renderMockupBoard, type DesignToDraw, type RenderDeps } from "./run";

/**
 * THE MOCKUP BOARD'S RUN (the wiring of decision 0092: the renderer-to-Run loop L2 left open).
 *
 * The panel asks the shell through `requestRun`; the shell checks the garment lock and the cost and
 * hands the board here. This file holds no rules of its own: it supplies `renderMockupBoard` with
 * the real reads, the real store and L1's own writer, and `run.ts` decides everything else.
 *
 * **Nothing paid happens.** A deterministic mockup is drawn by this platform from the design it
 * drew itself, so there is no provider, no reservation and no credit: the output is recorded with
 * `credits` null and the board's cost line stays empty.
 *
 * The picture is stored as a `render`, the kind this platform already keeps pictures it made under,
 * and handed to `recordOutput` as a `DrawnAsset` -- the only shape `run.ts` can make. The schema
 * constraint and `set_launch_board_output` ask the same question again in the database.
 */

/** The real reads, store and writes, for one launch project and one person. */
function renderDeps(who: Who, launchProjectId: string): RenderDeps {
  return {
    design: async (designProjectId, version): Promise<DesignToDraw | null> => {
      const client = await sessionClient();
      const [project, charts] = await Promise.all([
        getProjectAt(client, who.brandId, designProjectId, version ?? undefined).catch(() => null),
        brandChartSet(client, who.brandId),
      ]);
      if (project === null) return null;
      const { images } = await loadArtworkImages(createFileReader(client, who.brandId), shrinkForDrawing, project.spec);
      return { spec: project.spec, charts, images, version: project.currentVersion };
    },
    store: async (png) => {
      // `deterministic`: this platform drew these pixels from the design it drew itself. The file's
      // own row is what the garment lock reads (security review v5 H1, decision 0116), and it is
      // read back below rather than trusted from here, so the two must agree -- and they do,
      // because `lib/mockups/assets.ts` cannot produce anything but a drawn picture.
      const stored = await storeImage({ admin: adminClient(), brandId: who.brandId, userId: who.userId, kind: "render", provenance: "deterministic", bytes: png, statedType: "image/png" });
      return { fileId: stored.id, contentType: stored.contentType };
    },
    // `recordOutput` takes what the board asks for, not what made the file: it reads the provenance
    // from the file's row itself and then judges the ask. So the drawn asset `run.ts` built becomes
    // an offer here, and `showsPerson` is false because a mockup the platform drew has nobody in it.
    record: ({ boardId, kind, asset, status, credits }) =>
      recordOutput(adminClient(), who, {
        boardId,
        kind,
        status,
        credits,
        offer: asset === null ? null : { role: asset.role, file: asset.file, showsPerson: false },
      }),
    // The board keeps the design version it was drawn from, so a later version reads as stale
    // (`staleAgainst`) instead of a board quietly showing last week's kit.
    setInputVersion: async (board, version) => {
      await saveBoard(adminClient(), who, {
        launchProjectId,
        boardId: board.id,
        kind: board.kind,
        name: board.name,
        x: board.at.x,
        y: board.at.y,
        width: board.size.width,
        height: board.size.height,
        settings: board.settings,
        inputVersion: version,
      });
    },
  };
}

export const renderMockupBoardAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: renderMockupBoardBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const project = await loadLaunchProject(await sessionClient(), session.brand.id, input.launchProjectId);
    if (project === null) throw new AppError("not_found", "That launch project does not exist.");
    const graph = { boards: project.boards, edges: project.edges };
    const outcome = await renderMockupBoard(renderDeps(whoOf(session), input.launchProjectId), graph, input.boardId);
    if (!outcome.ok) throw new AppError("conflict", outcome.reason);
    revalidatePath(launchProjectPath(input.launchProjectId));
    return outcome;
  },
});
