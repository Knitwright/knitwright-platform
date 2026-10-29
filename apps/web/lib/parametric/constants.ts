import { z } from "zod";
import seeded from "./data/draft-constants.json";

/**
 * The drafting constants of one base article (plan v5 owner decisions 6 and 7): every number the
 * drafter draws with, as data rather than a literal in TypeScript, so a factory can set them per
 * article. `values` holds the numbers and `labels` says, group by group, which rulebook entry
 * covers them, where they came from and who has reviewed them — which is nobody yet. A group of
 * numbers with no label fails the parse, so a constant can never arrive unlabelled.
 */

const ruleId = z.string().regex(/^R-[A-Z]+-\d{3}$/);
const mm = z.number().finite();
const fraction = z.number().finite();
const mmWindow = z.tuple([mm, mm]);

const labelSchema = z.object({ key: z.string().min(1), rule: ruleId, label: z.string().min(1), source: z.string().min(1) });
export type ConstantLabel = z.output<typeof labelSchema>;

const valuesSchema = z.object({
  curves: z.object({
    front_neck: z.object({ control_1_drop_fraction: fraction, control_2_width_fraction: fraction }),
    front_armhole: z.object({ control_1_inset_fraction: fraction, control_1_drop_fraction: fraction, control_2_inset_mm: mm }),
    back_neck: z.object({ control_1_inset_mm: mm, control_1_drop_fraction: fraction, control_2_width_fraction: fraction }),
    back_armhole: z.object({ control_1_inset_fraction: fraction, control_1_drop_fraction: fraction, control_2_inset_mm: mm }),
    sleeve_cap: z.object({
      control_1_width_fraction: fraction,
      control_2_width_fraction: fraction,
      /** Total cap ease, which must sit inside the article's own `sleeve_cap_ease_target` window. */
      ease_mm: mm,
      /** The bracket and the halvings of the cap-height solve, which decide the doubles it returns. */
      solve_bracket_mm: mmWindow,
      solve_halvings: z.number().int().positive(),
    }),
  }),
  notches: z.object({
    armhole: z.object({ front_from_underarm_mm: z.array(mm).min(1), back_from_underarm_mm: z.array(mm).min(1) }),
    neck_rib: z.object({ fractions: z.array(fraction).min(1) }),
    cut: z.object({ slit_mm: z.number().positive(), curve_start_epsilon_mm: z.number().positive() }),
  }),
  drop_tail: z.object({
    /**
     * The four facts of owner decision 6, as data the drafter honours: a convention it cannot draw
     * stops the draft rather than being drawn differently from what it says.
     */
    convention: z.object({
      hem_level_to_side_seam: z.boolean(),
      drop_starts_at: z.string().min(1),
      side_seam_length_unchanged: z.boolean(),
      front_hem_moves: z.boolean(),
      back_hem_curve: z.string().min(1),
      horizontal_at_centre_back: z.boolean(),
      side_control_fraction: fraction,
      centre_control_fraction: fraction,
    }),
  }),
  cuff_k02: z.object({ rib: z.object({ finished_depth_mm: z.number().positive(), negative_ease_mm: mm }) }),
  master_pattern: z.object({ check: z.object({ tolerance_mm: z.number().positive() }) }),
});

export type DraftConstantValues = z.output<typeof valuesSchema>;

/** Every group of numbers in the values, as `section.group`, which is what a label is keyed by. */
export function constantGroups(values: DraftConstantValues): string[] {
  return Object.entries(values).flatMap(([section, groups]) => Object.keys(groups).map((group) => `${section}.${group}`));
}

export const draftConstantsSchema = z
  .object({ labels: z.array(labelSchema).min(1), values: valuesSchema })
  .superRefine((parsed, ctx) => {
    const labelled = new Set(parsed.labels.map((l) => l.key));
    for (const group of constantGroups(parsed.values)) {
      if (!labelled.has(group)) ctx.addIssue({ code: "custom", message: `No label for the draft constants ${group}.`, path: ["labels"] });
    }
  });

export type DraftConstants = z.output<typeof draftConstantsSchema>;

/**
 * Where the drafter gets an article's drafting constants. A factory sets them per article, so the
 * seam is the same as the article's own: the seeded defaults stand in until a stored row exists.
 */
export interface DraftConstantsSource {
  get(code: string): DraftConstants | null;
}

const seededSchema = z.object({ note: z.string(), articles: z.record(z.string(), draftConstantsSchema) });

/** A source over a fixed map of articles to constants. */
export function draftConstantsSource(byCode: Readonly<Record<string, DraftConstants>>): DraftConstantsSource {
  return { get: (code) => (Object.hasOwn(byCode, code) ? byCode[code] : null) };
}

/** The labelled defaults committed in `data/draft-constants.json`, which no factory has reviewed. */
export const SEEDED_DRAFT_CONSTANTS: DraftConstantsSource = draftConstantsSource(seededSchema.parse(seeded).articles);

/** The label of one group of constants, for a finding or a report line. */
export function labelOf(constants: DraftConstants, key: string): ConstantLabel | null {
  return constants.labels.find((l) => l.key === key) ?? null;
}

/** The rulebook entry that covers one group of constants; `R-GAP-000` where the rulebook has none. */
export function ruleOf(constants: DraftConstants, key: string): string | null {
  return labelOf(constants, key)?.rule ?? null;
}
