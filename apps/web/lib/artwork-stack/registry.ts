import { ALL_GENERATORS } from "@/lib/pattern-generators/registry";
import type { PatternGenerator } from "./generator";

/** Every generator the app draws with: the eight older styles and the pattern library (W7c, `lib/pattern-generators`). Code that draws takes the list as an argument. */
export const BUILT_IN_GENERATORS: readonly PatternGenerator[] = ALL_GENERATORS;

export const findGenerator = (id: string, generators: readonly PatternGenerator[] = BUILT_IN_GENERATORS): PatternGenerator | undefined =>
  generators.find((entry) => entry.id === id);
