import type { PatternGenerator } from "./generator";
import { KIT_STYLE_GENERATORS } from "./legacy/kit-styles";

/** The generators built in today. The pattern library (W7c) supplies the full list; code that draws takes the list as an argument. */
export const BUILT_IN_GENERATORS: readonly PatternGenerator[] = KIT_STYLE_GENERATORS;

export const findGenerator = (id: string, generators: readonly PatternGenerator[] = BUILT_IN_GENERATORS): PatternGenerator | undefined =>
  generators.find((entry) => entry.id === id);
