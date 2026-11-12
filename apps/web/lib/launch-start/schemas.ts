import { z } from "zod";
import { LAUNCH_SOURCES } from "./plan";

/** A form sends "" for a field left empty; that means "not given". */
const optional = <T extends z.ZodType>(inner: T) => z.preprocess((value) => (value === "" || value === undefined ? null : value), inner.nullable());

const slug = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,79}$/, "Choose a template from the list.");
const colourwayId = z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/);

/**
 * What a "Use template", "Edit", "Use this concept" or "Create an ad" button sends: where the
 * canvas starts from, and optionally which design and colourway. The brand and the person come
 * from the session; with no design named, the brand's newest design is used.
 */
export const startLaunchBody = z
  .object({
    source: z.enum(LAUNCH_SOURCES),
    slug: optional(slug),
    designProjectId: optional(z.uuid()),
    colourwayId: optional(colourwayId),
  })
  .refine((body) => body.source === "ad" || body.slug !== null, { message: "Choose a template from the list.", path: ["slug"] });

export type StartLaunchBody = z.output<typeof startLaunchBody>;
