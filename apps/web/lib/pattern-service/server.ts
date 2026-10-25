import "server-only";
import { getEnv } from "@/lib/config/env";
import { creditsService } from "@/lib/credits/server";
import { listBlocks } from "@/lib/pattern-library/service";
import { getProject } from "@/lib/projects/service";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import { loadStored } from "@/lib/settings/store";
import { quoteFrom } from "./quote";
import { requestPattern, type RequestDeps } from "./request";
import { createRequest } from "./service";

/** The request wired to the session, the settings, the library, the credits and the server's own database key. */
const deps = (): RequestDeps => ({
  design: async (brandId, projectId) => {
    const project = await getProject(await sessionClient(), brandId, projectId);
    return { name: project.name, garmentType: project.garmentType, currentVersion: project.currentVersion, spec: project.spec };
  },
  blocks: async (brandId) => listBlocks(await sessionClient(), brandId),
  quote: async () => quoteFrom(await loadStored(adminClient()).catch(() => ({}))),
  creditsEnforced: () => getEnv().CREDITS_ENFORCED,
  ensureAllowance: async (brandId) => {
    await creditsService().ensureMonthlyAllowance(brandId, new Date());
  },
  create: (input) => createRequest(adminClient(), input),
  log,
});

export const requestPatternForDesign = (who: Readonly<{ brandId: string; userId: string }>, projectId: string) => requestPattern(deps(), who, projectId);
