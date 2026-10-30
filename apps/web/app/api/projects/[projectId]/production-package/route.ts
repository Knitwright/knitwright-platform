import { z } from "zod";
import { serveProductionPackage } from "@/lib/kpp/sources/server";
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";

/** No handler may rely on more than 60 seconds (decision 0002). One article in seven sizes builds in well under that. */
export const maxDuration = 60;

/**
 * The production package (KPP) of a design version: one ZIP laid out as `docs/spec/04-production-package.md`
 * asks, built in memory when it is asked for and sent once. Decision 0070 and its two revisions describe
 * everything in it; this route is the mounting the package was waiting for.
 *
 * `03_patterns/**` and `04_print/**` are drawn on one and the same graded pattern — the Knitwright draft from
 * `lib/parametric` — so the pattern a factory cuts to and the files it prints cannot disagree. The package is
 * charged through `ChargeForPackage` rather than `withCredits`, because the F-G2 check has to come first: a
 * brand should never pay to be told what the factory still has to answer (decision 0070 revision 2, point 7).
 *
 * A design of another brand is not found. A package the gate refuses answers 409 and names every gap; that is
 * the gate doing its job, and today it is the usual answer, because no table holds the bill-of-materials
 * consumption, the care-label wording or the AQL plan.
 */
export const GET = defineRoute({
  auth: "member",
  rateLimit: LIMITS.printFiles,
  schema: { params: z.object({ projectId: z.uuid() }) },
  handler: async ({ input, session }) =>
    serveProductionPackage({ brandId: session.brand.id, brandName: session.brand.name, userId: session.userId }, input.params.projectId),
});
