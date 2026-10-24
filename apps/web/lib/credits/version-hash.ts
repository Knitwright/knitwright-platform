import { createHash } from "node:crypto";

/**
 * The name a credit line gives a saved design version. It is derived from the design's id and the
 * version number alone, so the code that charges an output and the code that moves the version to
 * "ordered" (which knows only those two) reach the same ledger lines without a lookup.
 */
export const designVersionHash = (projectId: string, version: number): string =>
  createHash("sha256").update(`design:${projectId}:version:${version}`).digest("hex");
