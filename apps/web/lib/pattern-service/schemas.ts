import { z } from "zod";

export const projectParams = z.object({ projectId: z.uuid() });

export const requestParams = z.object({ projectId: z.uuid(), requestId: z.uuid(), fileId: z.uuid().optional() });

/** Ops moves a request. A reason is required when it is declined. */
export const moveSchema = z
  .object({
    requestId: z.uuid(),
    to: z.enum(["accepted", "in_progress", "delivered", "declined"]),
    note: z.string().trim().max(500).default(""),
  })
  .refine((v) => v.to !== "declined" || v.note.length > 0, { message: "Say why the request is declined.", path: ["note"] });

export const reviewSchema = z.object({ requestId: z.uuid(), reviewerName: z.string().trim().min(1, "Give the reviewer's name.").max(120) });

export const attachParams = z.object({ requestId: z.uuid() });
