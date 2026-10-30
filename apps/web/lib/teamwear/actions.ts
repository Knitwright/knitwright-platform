"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBaseArticle } from "@/lib/catalogue";
import { defaultsOver } from "@/lib/editor";
import { brandChartSet } from "@/lib/charts/service";
import { createProject, loadCurrentDesign, saveTrustedActions } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { defineAction } from "@/lib/server/define-action";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { LIMITS } from "@/lib/server/limits";
import { configuratorHref, studioHref } from "./address";
import { partOf } from "./kit";
import { kitColourway } from "./preview";
import { saveKitSchema } from "./schemas";
import { sportById } from "./vocabulary";

/**
 * Saving a kit (spec F-T1 "Save" and "Design in Studio").
 *
 * The configurator holds nothing until this runs: a design version per colour tap would make a
 * history nobody can read. One press stores the part showing as a design in the club's colours, as
 * one version, and then either comes back to the configurator or opens the Studio editor on it.
 *
 * The garment type is read on the server from the sport and the part, never taken from the form, and
 * the option codes and the parameters are checked against the base article before they go into the
 * editor's address. The history note says the kit came from the configurator.
 *
 * A kit of three parts becomes a design per part, because a design in this platform is one garment
 * and there is no row that groups three of them. **Owner question** on the pull request: should a
 * kit be a row of its own, so one press saves all three and one link opens the set?
 */
export const saveKitAction = defineAction({
  auth: "member",
  rateLimit: LIMITS.createProject,
  schema: saveKitSchema,
  handler: async ({ input, session }) => {
    const sport = sportById(input.sportId);
    const part = partOf(sport, input.part);
    if (!part) throw new AppError("invalid_input", `${sport.label} has no ${input.part}.`);

    const client = await sessionClient();
    const id = await createProject(adminClient(), {
      brandId: session.brand.id,
      userId: session.userId,
      typeId: part.typeId,
      wearer: input.wearer,
      name: input.name,
      styleNumber: "",
      season: "",
      charts: await brandChartSet(client, session.brand.id),
    });

    const who = { brandId: session.brand.id, userId: session.userId, projectId: id, expectedVersion: 1 };
    const spec = await loadCurrentDesign(client, who);
    const body = input.part === "socks" ? input.socksColour : input.main;
    const trim = input.part === "socks" ? input.main : input.second;
    const outcome = await saveTrustedActions(adminClient(), client, {
      ...who,
      actions: [kitColourway(spec, body, trim)],
      // The closed list of sources has no teamwear member and `lib/projects/notes.ts` belongs to
      // nobody in this wave; "kit-style" is the nearest true one. Raised on the pull request.
      source: "kit-style",
      explanations: [`Configured in the teamwear configurator: ${part.label.toLowerCase()} for ${sport.label.toLowerCase()}, ${input.quantity} pieces.`],
    });
    if (!outcome.ok) throw new AppError("invalid_input", outcome.reason);

    revalidatePath("/studio");
    revalidatePath(`/studio/${id}`);

    const article = part.articleCode === null ? null : await getBaseArticle(client, part.articleCode).catch(() => null);
    const form = article === null ? { options: {}, parameters: {} } : defaultsOver(article, { options: input.options, parameters: input.parameters });
    const next =
      input.then === "studio"
        ? studioHref(id, { form, quantity: input.quantity, settled: [] })
        : configuratorHref({
            sportId: sport.id,
            part: input.part,
            saved: { projectId: id, version: outcome.version },
            // The kit goes back in the address, so the page this returns to opens the kit that was saved.
            kit: {
              wearer: input.wearer,
              colours: { main: input.main, second: input.second, third: input.third },
              socksColour: input.socksColour,
              quantity: input.quantity,
              form,
            },
          });
    redirect(next as Route);
  },
});
