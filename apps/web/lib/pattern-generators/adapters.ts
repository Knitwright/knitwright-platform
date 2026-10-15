import type { PatternGenerator } from "@/lib/artwork-stack/generator";
import { withBoundsCheck } from "./bounds";
import { KIT_STYLE_GENERATORS } from "@/lib/artwork-stack/legacy/kit-styles";

/**
 * The eight styles that existed before the library (hoops, stripes, pinstripes, sash, side panels, chest band, fade, polka
 * dots), under the registry. They are W7a's adapters, with a check on the area first, so their drawing is today's drawing exactly:
 * the files that draw it (`lib/flat/kit-pattern.ts`) are read, never edited. The old "fade" also has a preset of the
 * new fade generator (see `presets.ts`).
 */
export const ADAPTER_GENERATORS: readonly PatternGenerator[] = KIT_STYLE_GENERATORS.map(withBoundsCheck);
