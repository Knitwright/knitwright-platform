"use server";

import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { NO_DESIGN, readGarmentInspectorSchema } from "./input";
import { loadGarmentInspector } from "./server";
import type { GarmentInspectorView } from "./types";

/**
 * The garment inspector's one read (plan v6 E3, decision 0147): what the right panel shows for the
 * garment board a person selects, read when they select it rather than for every board when the
 * canvas opens. The brand comes from the session, never from the browser. Every change the inspector
 * makes goes through the editor's own `applyDesignActionAction`, so there is no write here.
 */
export const readGarmentInspectorAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.read,
  schema: readGarmentInspectorSchema,
  handler: async ({ input, session }): Promise<GarmentInspectorView> => {
    const view = await loadGarmentInspector(await sessionClient(), session.brand.id, input.designId, { colourwayId: input.colourwayId, options: input.options });
    if (view === null) throw new AppError("not_found", NO_DESIGN);
    return view;
  },
});
