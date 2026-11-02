import type { ArticleBook } from "@/lib/teamwear/kit";
import type { Pixels } from "@/lib/colour/palette";
import { defaultFactoryProfile, type FactoryProfile } from "@/lib/validation/profile";
import type { CheckRegistry } from "@/lib/validation/registry";
import { standardRegistry } from "@/lib/validation/spec-input";
import { vectoriseCheck, type CrestFile, type VectoriseCheck } from "./crest";
import { candidateKits } from "./engine";
import { crestColours, pickedColours, type CrestColour } from "./palette";
import { rankedKits, type KitRanker } from "./rank";
import { CREST_LIMITS, type FeelId, type RoleChoice } from "./settings";
import { ALL_SET_ASIDE, validatedKits, type ValidatedCandidate } from "./validate";

/**
 * The whole of crest-to-kit in one order (spec F-T2): read the crest's colours, snap them to what a
 * sublimation print is estimated to reach, build the kits, validate every one of them, and only
 * then let a model put them in an order and write a line.
 *
 * It is a pure function of its inputs. The pixels are a decoded COPY the caller made; the crest's
 * own bytes are carried through untouched, which `crest.test.ts` proves byte for byte. Nothing here
 * reaches a database, a network or a model unless the caller hands one in.
 */

export interface KitRunInput {
  readonly sportId: string;
  readonly feel: FeelId;
  readonly roles: RoleChoice;
  readonly clubName: string | null;
  /** The crest, or null when the club picked colours instead. */
  readonly crest: CrestFile | null;
  /** The crest decoded to pixels, or null. The crest's own bytes are never decoded in place. */
  readonly pixels: Pixels | null;
  /** The colours the club picked, used only when there is no crest. */
  readonly picked: readonly string[];
  readonly articles: ArticleBook;
  /** Null means no model is asked, which is what ships. */
  readonly ranker?: KitRanker | null;
  readonly profile?: FactoryProfile;
  readonly registry?: CheckRegistry;
}

export type KitRun =
  | Readonly<{
      status: "kits";
      palette: readonly CrestColour[];
      vectorise: VectoriseCheck | null;
      /** Only the kits that passed every check, in the order they are shown. */
      kits: readonly ValidatedCandidate[];
      /** Everything the club has to be told: a role, a family or a kit that could not be offered. */
      notes: readonly string[];
    }>
  | Readonly<{
      status: "none";
      palette: readonly CrestColour[];
      vectorise: VectoriseCheck | null;
      reason: string;
      notes: readonly string[];
    }>;

/** The palette of a run: the crest's own colours, else the ones the club picked. */
export function paletteOf(input: Pick<KitRunInput, "pixels" | "picked">): readonly CrestColour[] {
  if (input.pixels !== null) return crestColours(input.pixels);
  return pickedColours(input.picked);
}

/** The kits a crest yields, validated and ordered. The only entry point a screen needs. */
export async function runCrestToKit(input: KitRunInput): Promise<KitRun> {
  const palette = paletteOf(input);
  const vectorise = input.crest === null ? null : vectoriseCheck(input.crest);
  const built = candidateKits({
    sportId: input.sportId,
    feel: input.feel,
    roles: input.roles,
    palette,
    articles: input.articles,
    crest: input.crest,
  });
  if (built.status === "none") return { status: "none", palette, vectorise, reason: built.reason, notes: built.notes };
  const checked = validatedKits(built.candidates, input.articles, input.profile ?? defaultFactoryProfile(), input.registry ?? standardRegistry());
  if (checked.offered.length === 0) {
    return { status: "none", palette, vectorise, reason: ALL_SET_ASIDE, notes: [...built.notes, ...(checked.setAsideNote === null ? [] : [checked.setAsideNote])] };
  }
  const ranked = await rankedKits(
    checked.offered.map((one) => one.candidate),
    input.ranker ?? null,
    { clubName: input.clubName, sportId: input.sportId, feel: input.feel },
  );
  const byId = new Map(checked.offered.map((one) => [one.candidate.id, one] as const));
  return {
    status: "kits",
    palette,
    vectorise,
    kits: ranked.candidates.flatMap((candidate) => {
      const found = byId.get(candidate.id);
      return found === undefined ? [] : [{ candidate, validation: found.validation }];
    }),
    notes: [
      ...built.notes,
      ...(checked.setAsideNote === null ? [] : [checked.setAsideNote]),
      ...(ranked.note === null ? [] : [ranked.note]),
      ...(vectorise !== null && !vectorise.sharpEnough ? [vectorise.message] : []),
    ],
  };
}

/** Whether a measured run met the specification's thirty seconds. A measurement that is not a number fails. */
export const withinKitBudget = (milliseconds: number): boolean =>
  Number.isFinite(milliseconds) && milliseconds >= 0 && milliseconds < CREST_LIMITS.budgetMs;
