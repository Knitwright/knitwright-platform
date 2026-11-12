import "server-only";
import { completionOf } from "@/lib/brand-studio/completion";
import { loadRecord } from "@/lib/brand-studio/service";
import { creditSummaryFor } from "@/lib/credits/server";
import { getBrandDetails } from "@/lib/leads/service";
import type { Brand } from "@/lib/server/core/guard";
import { sessionClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import type { Workspace } from "@/lib/shell/nav";
import { loadWorkspace } from "@/lib/shell/workspace";

/**
 * What the shell reads for every signed-in page (decision 0138): whether the workspace is a club and
 * whether its brand is set up, and the credit balance. Both are read with the member's own client,
 * so row security answers for them, and neither can stop a page opening: a failed read is logged and
 * the shell draws without it, as the v2.2 credits chip and completion pill did.
 */

export async function readWorkspace(brand: Brand): Promise<Workspace> {
  const client = await sessionClient();
  return loadWorkspace(
    async () => {
      const [record, details] = await Promise.all([loadRecord(client, brand), getBrandDetails(client, brand.id)]);
      const detailsStep = completionOf(record).steps.find((step) => step.key === "details");
      return { organisationType: details.organisationType, kind: record.profile.kind, detailsDone: detailsStep?.done ?? false };
    },
    (error) => log({ level: "warn", message: "The shell could not read the workspace", where: "layout (app)", error }),
  );
}

export async function readCredits(brandId: string): Promise<number | null> {
  return creditSummaryFor(brandId)
    .then((summary) => summary.balance)
    .catch(() => null);
}
