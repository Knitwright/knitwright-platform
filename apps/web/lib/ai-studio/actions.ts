"use server";

import { revalidatePath } from "next/cache";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { liveKinds } from "@/lib/flows/real/server";
import { LAUNCH_HOME, launchProjectPath } from "@/lib/launch/menu";
import { listArtboardPresets } from "@/lib/launch/service";
import { getProject } from "@/lib/projects/project-reads";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { checkAnswers } from "./answers";
import { availabilityOf } from "./availability";
import { planCanvas } from "./canvas-plan";
import { runnableById } from "./catalogue";
import { formOf } from "./forms";
import { recolourKit, retroRemix } from "./remix";
import { makeVariants, saveVariant, type VariantMaker } from "./remix-service";
import { startCanvas } from "./service";
import { applyVariantBody, recolourBody, remixBody, startWorkflowBody, type ApplyVariantBody } from "./schemas";

/**
 * The AI Studio actions (decision 0141). The brand and the person come from the session, the role is
 * checked here and again in every database function, and nothing here calls a paid provider: a canvas
 * workflow sets a launch canvas up and returns its address, where runs show their cost first.
 */

const LIVE = () => ({ ...liveKinds(), removeBackground: false });

export const startWorkflowAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.clubWrite,
  schema: startWorkflowBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const workflow = runnableById(input.workflowId);
    const form = formOf(input.workflowId);
    if (!workflow || !form) throw new AppError("not_found", "That workflow does not exist.");
    const available = availabilityOf(workflow, LIVE());
    if (!available.available) throw new AppError("conflict", available.body);
    const checked = checkAnswers(form, { ...input.answers, product: input.projectId }, input.count);
    if (!checked.ok) throw new AppError("invalid_input", Object.values(checked.errors)[0] ?? "Check the form.");
    const client = await sessionClient();
    const [project, presets] = await Promise.all([getProject(client, session.brand.id, input.projectId), listArtboardPresets(client)]);
    const plan = planCanvas(workflow.id, checked.answers, checked.count, presets);
    if (plan === null) throw new AppError("not_found", "That workflow does not open on a canvas.");
    const id = await startCanvas(adminClient(), whoOf(session), {
      name: `${workflow.title} · ${project.name}`.slice(0, 80),
      designProjectId: project.id,
      designVersion: project.currentVersion,
      plan,
      presets,
    });
    revalidatePath(LAUNCH_HOME);
    return { href: launchProjectPath(id) };
  },
});

const remixMaker = (input: Pick<ApplyVariantBody & { kind: "remix" }, "era" | "family">): VariantMaker => (spec, gate) => retroRemix(spec, input, gate);
const recolourMaker = (input: { main: string; second: string | null }): VariantMaker => (spec, gate) => recolourKit(spec, input, gate);

const whoFor = (session: { brand: { id: string; name: string }; userId: string }) => ({ brandId: session.brand.id, brandName: session.brand.name, userId: session.userId });

export const remixKitAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.variantsRender,
  schema: remixBody,
  handler: async ({ input, session }) => makeVariants(await sessionClient(), whoFor(session), input.projectId, remixMaker(input)),
});

export const recolourKitAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.variantsRender,
  schema: recolourBody,
  handler: async ({ input, session }) => makeVariants(await sessionClient(), whoFor(session), input.projectId, recolourMaker(input)),
});

const makerOf = (input: ApplyVariantBody): VariantMaker => (input.kind === "remix" ? remixMaker(input) : recolourMaker(input));

export const applyKitVariantAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.editDesign,
  schema: applyVariantBody,
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    const version = await saveVariant({ client: await sessionClient(), admin: adminClient() }, whoFor(session), {
      projectId: input.projectId,
      expectedVersion: input.expectedVersion,
      variantId: input.variantId,
      make: makerOf(input),
      source: input.kind === "remix" ? "Retro kit remix" : "Change kit colour",
    });
    revalidatePath(`/studio/${input.projectId}`);
    return { version, href: `/studio/${input.projectId}` };
  },
});
