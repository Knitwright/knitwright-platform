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
 * Orders a validated design version and gives its credits back. Nothing calls it yet (decision 0051).
 *
 * Since plan v6 D1 (decision 0132) a version is marked `ordered` by `submit_order_for_production`
 * itself, in the same transaction as the order, so every order path does it and none can forget. A
 * version that is already ordered refuses `writeDesignStatus(..., "ordered", ...)`, so whoever wires
 * the refund (owner question D1-3 of decision 0132) calls `refundForOrder` alone, after the order.
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
