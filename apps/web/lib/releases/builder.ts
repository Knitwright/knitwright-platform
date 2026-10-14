import type { PrintFileBuilder } from "@/lib/production/contract";
import { AppError } from "@/lib/server/core/errors";
import type { BuilderFor } from "./use-cases";

/**
 * The print file builder the routes use. The real one belongs to the print workstream (W3) and is
 * joined here when it merges: change `printFileBuilder` to return it. Until then a release cannot
 * be frozen, because nothing can make the files to hash, and the routes say so in plain words.
 */
export const unavailableBuilder: PrintFileBuilder = {
  async build() {
    throw new AppError("unavailable", "Print files cannot be made yet, so a release cannot be frozen.");
  },
};

export const printFileBuilder: BuilderFor = () => unavailableBuilder;
