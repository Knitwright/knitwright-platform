import { CHECK_KINDS } from "./checks";
import { GEOMETRIC_MOTIFS } from "./geometric";
import { GRADIENT_MODES } from "./gradient";
import { STRIPE_RHYTHMS } from "./stripe-rhythm";

/**
 * Settings that pick from a short list are stored as the number of the choice (the interface holds numbers).
 * This is the plain name of each choice, so a person and the assistant speak in names, never in numbers.
 */
export const CHOICES: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  geometric: { motif: GEOMETRIC_MOTIFS },
  gradient: { mode: GRADIENT_MODES },
  checks: { kind: CHECK_KINDS },
  "stripe-rhythm": { rhythm: STRIPE_RHYTHMS },
};

export const choicesOf = (generatorId: string, paramId: string): readonly string[] | undefined => CHOICES[generatorId]?.[paramId];
