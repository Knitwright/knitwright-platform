import { z } from "zod";
import { printProfileSchema, sha256Schema } from "./print";

export const releaseFileSchema = z.object({
  /** A name that says what the file is, such as "print/front-48.pdf". */
  path: z
    .string()
    .min(1)
    .max(200)
    .refine((p) => !p.startsWith("/") && !p.split("/").some((part) => part === ".." || part === "" || part === "."), {
      message: "A file path is relative and stays inside the release.",
    }),
  sha256: sha256Schema,
});

/** Everything needed to print the same files again. A release holds this, not the files. */
export const releaseSnapshotSchema = z.object({
  specVersion: z.number().int().min(1),
  patternBlockId: z.string().min(1).max(120),
  patternBlockVersion: z.number().int().min(1),
  fabricTestIds: z.array(z.string().min(1).max(64)).max(50),
  printProfile: printProfileSchema,
  rosterHash: sha256Schema.nullable(),
  files: z.array(releaseFileSchema).max(5000),
});
export type ReleaseSnapshot = z.output<typeof releaseSnapshotSchema>;
