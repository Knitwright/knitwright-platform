import { z } from "zod";
import { MAX_MENTIONS } from "./limits";
import { cleanComment } from "./text";

export const projectParams = z.object({ projectId: z.uuid() });
export const commentParams = z.object({ projectId: z.uuid(), commentId: z.uuid() });

/** The words, cleaned like a player's name is (text.ts). The raw string is capped before cleaning so a huge body is refused early. */
const words = z
  .string()
  .max(10_000)
  .transform((raw, ctx) => {
    const cleaned = cleanComment(raw);
    if (!cleaned.ok) {
      ctx.addIssue({ code: "custom", message: cleaned.message });
      return z.NEVER;
    }
    return cleaned.text;
  });

const mentions = z
  .array(z.uuid())
  .max(MAX_MENTIONS)
  .default([])
  .transform((ids) => [...new Set(ids)]);

const mm = z.number().min(0).max(5000);

export const createBody = z
  .object({
    body: words,
    /** The saved version the comment is about. A reply takes its thread's. */
    version: z.number().int().min(1).max(2147483647),
    parentId: z.uuid().nullable().default(null),
    panelId: z.string().trim().min(1).max(64).nullable().default(null),
    xMm: mm.nullable().default(null),
    yMm: mm.nullable().default(null),
    mentions,
  })
  .strict()
  .superRefine((value, ctx) => {
    const fail = (message: string, path: string): void => ctx.addIssue({ code: "custom", message, path: [path] });
    if ((value.xMm === null) !== (value.yMm === null)) fail("Give both distances for a point.", "xMm");
    if (value.xMm !== null && value.panelId === null) fail("A point needs a panel.", "panelId");
    if (value.parentId !== null && value.panelId !== null) fail("A reply goes with its thread, not a panel.", "panelId");
  });
export type CreateBody = z.output<typeof createBody>;

export const editBody = z.object({ body: words, mentions }).strict();
export type EditBody = z.output<typeof editBody>;

export const resolveBody = z.object({ resolved: z.boolean() }).strict();
