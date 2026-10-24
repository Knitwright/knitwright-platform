import { z } from "zod";
import { requireAbility } from "@/lib/clubs/guards";
import { readRosterCsv } from "@/lib/clubs/roster";
import { rosterImportBody } from "@/lib/clubs/schemas";
import { getRoster } from "@/lib/clubs/service";
import { defineRoute } from "@/lib/server/define-route";
import { sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";

const params = z.object({ seasonId: z.uuid() });

/**
 * Reads a CSV and saves nothing. The person looks at the players and the problems, then saves the
 * roster with PUT. The season must be the club's own, so a stranger's season id learns nothing.
 */
export const POST = defineRoute({
  auth: "member",
  rateLimit: LIMITS.rosterImport,
  maxBodyBytes: 400_000,
  schema: { params, body: rosterImportBody },
  handler: async ({ input, session }) => {
    requireAbility(session, "manageKit");
    await getRoster(await sessionClient(), session.brand.id, input.params.seasonId);
    return readRosterCsv(input.body.csv, {
      ...(input.body.header === undefined ? {} : { header: input.body.header }),
      ...(input.body.mapping === undefined ? {} : { mapping: input.body.mapping }),
    });
  },
});
