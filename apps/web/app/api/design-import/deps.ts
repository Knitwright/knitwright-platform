import "server-only";
import type { z } from "zod";
import { createImageCleanup } from "@/lib/design-import/cleanup-image";
import {
  DESIGN_IMPORT_MAX_IMAGE_EDITS,
  DESIGN_READ_INPUT_TOKENS,
  DESIGN_READ_OUTPUT_TOKENS,
  IMAGE_EDIT_MICRODOLLARS,
  callCost,
  designImportCost,
} from "@/lib/providers/catalog";
import type { StartDeps } from "@/lib/design-import/service";
import { createImportStore, type ImportStore } from "@/lib/design-import/store";
import { starterTemplate } from "@/lib/design-import/template";
import { getEnv } from "@/lib/config/env";
import { createFalProvider } from "@/lib/providers/fal";
import { MODEL_TIMEOUT_MS, assistantModels } from "@/lib/projects/assistant";
import type { RouteUsage } from "@/lib/server/core/metered";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { DESIGN_IMPORT_DAILY_PER_BRAND } from "@/lib/server/limits";
import { log } from "@/lib/server/log";
import { createFileReader } from "@/lib/storage/read";
import type { Cost } from "@/lib/usage/cost";
import type { ViewId } from "@/lib/artwork-stack";
import { refitSchema } from "@/lib/design-import/schemas";

/** Wiring for the design-import routes: the outside services, handed to the library. Server only. */

const cleanupFor = () => {
  const key = getEnv().FAL_KEY;
  return key ? createImageCleanup(createFalProvider({ apiKey: key })) : null;
};

/** The most a reading can cost, reserved before it runs. Null while the switch is off or no model is set. */
export function importCost(): Cost | null {
  if (!getEnv().DESIGN_FROM_PICTURE) return null;
  const primary = assistantModels().primary;
  return primary ? { feature: "ai", microdollars: designImportCost(primary.entry, { withEdits: cleanupFor() !== null }) } : null;
}

export async function importStore(): Promise<ImportStore> {
  return createImportStore(adminClient(), await sessionClient());
}

export async function startDeps(brandId: string, usage: RouteUsage | null): Promise<StartDeps> {
  const client = await sessionClient();
  const primary = assistantModels().primary;
  const readCost = primary ? callCost(primary.entry, DESIGN_READ_INPUT_TOKENS, DESIGN_READ_OUTPUT_TOKENS) : 0;
  return {
    store: createImportStore(adminClient(), client),
    enabled: getEnv().DESIGN_FROM_PICTURE,
    provider: primary?.provider ?? null,
    templates: starterTemplate,
    cleanup: cleanupFor(),
    projectInBrand: async (projectId) => {
      const { data } = await client.from("projects").select("id").eq("id", projectId).eq("brand_id", brandId).maybeSingle();
      return data !== null;
    },
    readFile: (fileId, maxBytes) => createFileReader(client, brandId).read(fileId, maxBytes),
    usage,
    priceOf: (budget) => budget.visionCalls * readCost + Math.min(budget.imageEdits, DESIGN_IMPORT_MAX_IMAGE_EDITS) * IMAGE_EDIT_MICRODOLLARS,
    log,
    timeoutMs: MODEL_TIMEOUT_MS,
    dailyCap: DESIGN_IMPORT_DAILY_PER_BRAND,
    now: () => new Date(),
  };
}

export type RefitBody = z.output<typeof refitSchema>;

export const refitEdits = (body: RefitBody): { view: ViewId; edits: { id: RefitBody["edits"][number]["id"]; side: RefitBody["edits"][number]["side"]; at: { x: number; y: number } }[] } => ({
  view: body.view,
  edits: body.edits.map((edit) => ({ id: edit.id, side: edit.side, at: { x: edit.x, y: edit.y } })),
});
