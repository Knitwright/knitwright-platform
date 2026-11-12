"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { flowTemplate } from "@/lib/flows/templates";
import { applyFlowTemplate } from "@/lib/flows/service";
import { LAUNCH_HOME, launchProjectPath } from "@/lib/launch";
import { connectBoards, createLaunchProject, listArtboardPresets, saveBoard, type Who } from "@/lib/launch/service";
import { listMarketingTemplates } from "@/lib/marketing/service";
import { loadMockupScene } from "@/lib/mockups/service";
import { getProjectAt, listProjects } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { designBoard, landingPath, launchName, marketingBoard, mockupBoard, type PlannedBoard, type StartDesign } from "./plan";
import { startLaunchBody, type StartLaunchBody } from "./schemas";

/**
 * Opens a new launch canvas from a dashboard page (decision 0140): a flow pack from Templates, a
 * mockup scene from Mockups, a layout or an empty ad from Marketing. Everything is saved through
 * L1's own functions, which check the role and the brand again, and the person lands on the canvas
 * with the new board selected. Nothing is run and nothing is charged.
 */

const GONE = "That template is no longer in the library.";

/** The design the canvas starts from: the one named, or the brand's newest, or none. */
async function designFor(client: SupabaseClient, brandId: string, id: string | null): Promise<StartDesign | null> {
  if (id !== null) {
    const project = await getProjectAt(client, brandId, id);
    return { id: project.id, name: project.name, version: project.currentVersion };
  }
  const newest = (await listProjects(client, brandId, 1)).projects[0];
  return newest === undefined ? null : { id: newest.id, name: newest.name, version: newest.currentVersion };
}

/** The board the source asks for, and its title. A flow pack is laid out by `applyFlowTemplate` instead. */
async function boardFor(client: SupabaseClient, input: StartLaunchBody): Promise<Readonly<{ board: PlannedBoard; panel: "mockups" | null }>> {
  if (input.source === "mockup") {
    const stored = await loadMockupScene(client, input.slug ?? "");
    if (stored === null) throw new AppError("not_found", GONE);
    return { board: mockupBoard(stored.scene, input.colourwayId), panel: "mockups" };
  }
  const presets = await listArtboardPresets(client);
  if (input.source === "ad") return { board: marketingBoard(null, presets), panel: null };
  const pick = (await listMarketingTemplates(client)).find((one) => one.slug === input.slug);
  if (pick === undefined) throw new AppError("not_found", GONE);
  return { board: marketingBoard(pick, presets), panel: null };
}

const save = (who: Who, launchProjectId: string, board: PlannedBoard): Promise<string> =>
  saveBoard(adminClient(), who, { launchProjectId, boardId: null, ...board });

async function startFlow(client: SupabaseClient, who: Who, slug: string, design: StartDesign | null): Promise<string> {
  const spec = flowTemplate(slug);
  if (spec === null) throw new AppError("not_found", GONE);
  const id = await createLaunchProject(adminClient(), who, { name: launchName(spec.title), units: "px", designProjectId: design?.id ?? null });
  await applyFlowTemplate(adminClient(), who, {
    launchProjectId: id,
    template: spec.slug,
    designProjectId: design?.id ?? null,
    designVersion: design?.version ?? null,
    presets: await listArtboardPresets(client),
  });
  return launchProjectPath(id);
}

async function startBoard(client: SupabaseClient, who: Who, input: StartLaunchBody, design: StartDesign | null): Promise<string> {
  const { board, panel } = await boardFor(client, input);
  const id = await createLaunchProject(adminClient(), who, { name: launchName(board.name), units: "px", designProjectId: design?.id ?? null });
  const fromId = design === null ? null : await save(who, id, designBoard(design));
  const toId = await save(who, id, board);
  if (fromId !== null) await connectBoards(adminClient(), who, { launchProjectId: id, fromBoardId: fromId, toBoardId: toId, inputIndex: 1 });
  return landingPath(id, toId, panel);
}

export const startLaunchAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: startLaunchBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const client = await sessionClient();
    const who = whoOf(session);
    const design = await designFor(client, who.brandId, input.designProjectId);
    const path = input.source === "flow" ? await startFlow(client, who, input.slug ?? "", design) : await startBoard(client, who, input, design);
    revalidatePath(LAUNCH_HOME);
    redirect(path as Route);
  },
});
