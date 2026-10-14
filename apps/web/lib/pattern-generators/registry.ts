import type { PatternGenerator } from "@/lib/artwork-stack/generator";
import { KIT_STYLE_GENERATORS } from "@/lib/artwork-stack/legacy/kit-styles";
import { brush } from "./brush";
import { camo } from "./camo";
import { checks } from "./checks";
import { geometric } from "./geometric";
import { gradient } from "./gradient";
import { halftone } from "./halftone";
import { stripeRhythm } from "./stripe-rhythm";

/**
 * The eight styles that exist today (hoops, stripes, pinstripes, sash, side panels, chest band, fade, dots), under the
 * registry with the ids and drawing they have always had: a design saved with `kit-hoops` draws exactly as before.
 */
export const ADAPTERS: readonly PatternGenerator[] = KIT_STYLE_GENERATORS;

export const NEW_GENERATORS: readonly PatternGenerator[] = [camo, geometric, gradient, halftone, checks, brush, stripeRhythm];

/** Every generator, old and new, in the order a gallery shows them. */
export const ALL_GENERATORS: readonly PatternGenerator[] = [...ADAPTERS, ...NEW_GENERATORS];

export const findGenerator = (id: string): PatternGenerator | undefined => ALL_GENERATORS.find((entry) => entry.id === id);
