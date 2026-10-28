import "server-only";
import { getEnv } from "@/lib/config/env";
import { creditsService } from "@/lib/credits/server";
import { log } from "@/lib/server/log";
import type { StatusRecord } from "@/lib/validation";
import { writeDesignStatus } from "@/lib/validation/service";
import { getProject } from "@/lib/projects/service";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { createGate } from "./gate";
import { orderVersion } from "./order";
import { createWithCredits } from "./with-credits";

/** The gate wired to the owner's flag, the credit ledger and the server log. */
const productionGate = createGate({
  enforced: () => getEnv().CREDITS_ENFORCED,
  service: creditsService,
  log,
  now: () => new Date(),
});

export const withCredits = createWithCredits(productionGate);

/** The design the request is about and the version of it an output is made from; null when the version does not exist. */
export const versionOf = async (
  brandId: string,
  projectId: string,
  asked?: number,
): Promise<Readonly<{ projectId: string; version: number }> | null> => {
  const { currentVersion } = await getProject(await sessionClient(), brandId, projectId);
  const version = asked ?? currentVersion;
  return version >= 1 && version <= currentVersion ? { projectId, version } : null;
};

/**
 * Orders a validated design version and gives its credits back. The order flow calls this in place
 * of `writeDesignStatus(..., "ordered", ...)`; nothing calls it yet (decision 0051).
 */
export const orderDesignVersion = (
  who: Readonly<{ brandId: string; userId: string }>,
  projectId: string,
  version: number,
  record: Pick<StatusRecord, "profileId" | "findingsHash">,
) =>
  orderVersion(
    {
      writeOrdered: () => writeDesignStatus(adminClient(), who, projectId, version, "ordered", record),
      refundForOrder: (input) => creditsService().refundForOrder(input),
      log,
    },
    who,
    projectId,
    version,
  );
