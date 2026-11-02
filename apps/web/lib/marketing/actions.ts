"use server";

import { loadRecord } from "@/lib/brand-studio/service";
import { requireAbility, whoOf } from "@/lib/clubs/guards";
import { getEnv } from "@/lib/config/env";
import { loadLaunchProject } from "@/lib/launch/service";
import { chooseModels } from "@/lib/providers/select";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { productionDeps, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { marketingSettings } from "./board";
import { voiceFromRecord } from "./copy/voice";
import { writerFrom } from "./copy/writer";
import type { WriteResult } from "./copy/write";
import { MARKETING_RULE } from "./rules";
import { writeCopyBody } from "./schemas";
import { buildMarketingTemplates } from "./templates/build";
import type { MarketingSlot } from "./templates/types";

/**
 * "WRITE FOR ME", WIRED (spec F-L2; L4 left this one action to the wiring step, decision 0094).
 *
 * L4 owns the words, the prompt, the cleaning and the meter (`lib/marketing/copy/**`), and
 * `writerFrom` is the five lines that put the model, the meter and the person together. All this
 * action does is decide **what the model is allowed to be asked**, and it decides it from the
 * server's own reads rather than from the body:
 *
 *   * the board comes from the canvas, so a person can only write into a board of their own brand;
 *   * the slot comes from the template that board took on, in the library's own copy of it, so a
 *     slot that is not a text field cannot be smuggled in and `writeForMe` refuses one anyway;
 *   * the voice comes from Brand Studio's record, so nobody can put words in a brand's mouth by
 *     sending a voice of their own.
 *
 * **Nothing is charged in credits** (owner question 1 on decision 0094: there is no credit price
 * for AI copy). The platform's own spend is metered in microdollars like every other text call, and
 * reserved before the call and given back on a failure by `meteredWriter`.
 *
 * With no model key set `writerFrom` answers null and this action refuses in the panel's own words,
 * which is why "Write for me" says it is not connected rather than failing on a press.
 */

const NOT_CONNECTED = "Write for me is not connected yet, so nothing has been sent.";
const NO_TEMPLATE = "This board has no layout yet, so there is no field to write into.";
const NO_SLOT = "That field is not on this layout.";

const refused = (reason: string): WriteResult => ({ ok: false, reason, ruleId: MARKETING_RULE });

/** The slot of the template a board took on, read out of the library's own copy. */
function slotOf(settings: Readonly<Record<string, unknown>>, slotId: string): MarketingSlot | null {
  const slug = marketingSettings(settings).templateSlug;
  if (slug === null) return null;
  const template = buildMarketingTemplates().find((one) => one.slug === slug);
  return template?.slots.find((slot) => slot.id === slotId) ?? null;
}

export const writeMarketingCopyAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.assistant,
  schema: writeCopyBody,
  handler: async ({ input, session }): Promise<WriteResult> => {
    requireAbility(session, "manageKit");
    const client = await sessionClient();
    const project = await loadLaunchProject(client, session.brand.id, input.launchProjectId);
    const board = project?.boards.find((one) => one.id === input.boardId);
    if (!board) throw new AppError("not_found", "That board does not exist.");
    if (marketingSettings(board.settings).templateSlug === null) return refused(NO_TEMPLATE);
    const slot = slotOf(board.settings, input.slotId);
    if (slot === null) return refused(NO_SLOT);

    const writer = writerFrom(chooseModels(getEnv()), productionDeps.usage, whoOf(session));
    if (writer === null) return refused(NOT_CONNECTED);
    const record = await loadRecord(client, { id: session.brand.id, name: session.brand.name });
    return writer.write({ slot, highlight: input.highlight, campaign: input.campaign, voice: voiceFromRecord(record) });
  },
});
