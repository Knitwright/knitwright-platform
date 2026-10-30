import { z } from "zod";
import { ruleIdSchema } from "@/lib/factory/schemas";

/**
 * The compliance rows as the app sees them (decision 0089): the ISO 3758 care symbols, the AQL plan, and the
 * label wording inside `country_rules.label_rules`. Rows come from `20261120070000_compliance.sql`.
 *
 * Every schema is deliberately forgiving about what a row does *not* say. A care symbol with no words, a
 * market with no size wording and an AQL plan with no level all parse: they are the honest state of the data
 * today, and the checklist refuses the export and names them. What never parses is a value dressed up as
 * sourced when it is not: `careLine` and `wordingLine` keep `source` beside the text, and `labels.ts` prints
 * neither without the other.
 */

export const CARE_KINDS = ["washing", "bleaching", "drying", "ironing", "professional"] as const;
export type CareKind = (typeof CARE_KINDS)[number];

export const CARE_SOURCE_KINDS = ["standard", "supplier", "factory", "knitwright"] as const;

export const careSymbolSchema = z.object({
  id: z.uuid(),
  code: z.string().min(1).max(48),
  kind: z.enum(CARE_KINDS),
  /** The standard's reference for the symbol. Null: not transcribed from the standard. */
  symbolRef: z.string().nullable(),
  /** The words a factory reads beside the symbol. Null: nobody has written them. */
  words: z.string().nullable(),
  language: z.string().min(2).max(5),
  /** Where the words came from. Null: nowhere, and the symbol never reaches a label. */
  source: z.string().nullable(),
  sourceKind: z.enum(CARE_SOURCE_KINDS).nullable(),
  confirmed: z.boolean(),
  ruleId: ruleIdSchema,
  label: z.string().min(1).max(300),
});
export type CareSymbol = z.output<typeof careSymbolSchema>;

export const AQL_SCOPES = ["class_a_sample", "run"] as const;
export type AqlScope = (typeof AQL_SCOPES)[number];

export const aqlPlanSchema = z.object({
  id: z.uuid(),
  /** Null: the plan applies to every factory. */
  factoryId: z.uuid().nullable(),
  scope: z.enum(AQL_SCOPES),
  inspectEveryPiece: z.boolean(),
  inspectionLevel: z.string().nullable(),
  criticalAql: z.number().nullable(),
  majorAql: z.number().nullable(),
  minorAql: z.number().nullable(),
  source: z.string().nullable(),
  confirmed: z.boolean(),
  ruleId: ruleIdSchema,
  label: z.string().min(1).max(300),
});
export type AqlPlan = z.output<typeof aqlPlanSchema>;

export const CARE_SYMBOL_COLUMNS =
  "id, code, kind, symbol_ref, words, language, source, source_kind, confirmed, rule_id, label";
export const AQL_PLAN_COLUMNS =
  "id, factory_id, scope, inspect_every_piece, inspection_level, critical_aql, major_aql, minor_aql, source, confirmed, rule_id, label";

type Row = Record<string, unknown>;

/** numeric columns may come back as text. They become numbers, and null stays null. */
const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null);

export const toCareSymbol = (r: Row): CareSymbol =>
  careSymbolSchema.parse({
    id: r.id,
    code: r.code,
    kind: r.kind,
    symbolRef: str(r.symbol_ref),
    words: str(r.words),
    language: r.language,
    source: str(r.source),
    sourceKind: str(r.source_kind),
    confirmed: r.confirmed === true,
    ruleId: r.rule_id,
    label: r.label,
  });

export const toAqlPlan = (r: Row): AqlPlan =>
  aqlPlanSchema.parse({
    id: r.id,
    factoryId: r.factory_id ?? null,
    scope: r.scope,
    inspectEveryPiece: r.inspect_every_piece === true,
    inspectionLevel: str(r.inspection_level),
    criticalAql: num(r.critical_aql),
    majorAql: num(r.major_aql),
    minorAql: num(r.minor_aql),
    source: str(r.source),
    confirmed: r.confirmed === true,
    ruleId: r.rule_id,
    label: r.label,
  });

/**
 * One line of a label, with where it came from. `text` null means nobody has written it; `source` null means
 * nothing in the platform vouches for it, and `labels.ts` leaves it off the label either way.
 */
export type WordingLine = Readonly<{
  text: string | null;
  source: string | null;
  confirmed: boolean;
}>;

/** The fibre line also carries the language and the order a market requires it in. */
export type FibreLine = WordingLine & Readonly<{ language: string | null; order: string | null }>;

export type ImporterLine = WordingLine & Readonly<{ required: boolean | null }>;

export type CareLine = Readonly<{ symbolCodes: readonly string[]; source: string | null; confirmed: boolean }>;

/** `country_rules.label_rules`, as the label builder reads it. An empty object gives every line empty. */
export type LabelRules = Readonly<{
  fibre: FibreLine;
  care: CareLine;
  origin: WordingLine;
  size: WordingLine;
  importer: ImporterLine;
  /** True where the market needs CPSIA testing before anything is sold (spec F-G3). Null: not recorded. */
  cpsiaRequired: boolean | null;
  cpsiaSource: string | null;
  /** The row's own label, as every seeded value in the platform carries one. */
  label: string | null;
}>;

const lineSchema = z.object({
  text: z.string().nullish().transform((v) => str(v)),
  source: z.string().nullish().transform((v) => str(v)),
  confirmed: z.boolean().nullish().transform((v) => v === true),
});

const linesSchema = z.object({
  fibre: lineSchema
    .extend({
      language: z.string().nullish().transform((v) => str(v)),
      order: z.string().nullish().transform((v) => str(v)),
    })
    .nullish(),
  care: z
    .object({
      symbolCodes: z.array(z.string()).nullish().transform((v) => v ?? []),
      source: z.string().nullish().transform((v) => str(v)),
      confirmed: z.boolean().nullish().transform((v) => v === true),
    })
    .nullish(),
  origin: lineSchema.nullish(),
  size: lineSchema.nullish(),
  importer: lineSchema.extend({ required: z.boolean().nullish().transform((v) => v ?? null) }).nullish(),
});

const storedSchema = z.object({
  lines: linesSchema.nullish(),
  /** The flat key `lib/kpp/input/labels.ts` already reads. It describes the same label. */
  origin: z.string().nullish().transform((v) => str(v)),
  cpsiaRequired: z.boolean().nullish().transform((v) => (typeof v === "boolean" ? v : null)),
  cpsiaSource: z.string().nullish().transform((v) => str(v)),
  label: z.string().nullish().transform((v) => str(v)),
});

const EMPTY: WordingLine = { text: null, source: null, confirmed: false };

/**
 * What one market's `label_rules` says, with nothing invented for what it does not say. Anything the column
 * holds that this does not understand is ignored rather than guessed at, and an unreadable column reads as
 * "nothing is written", which the checklist refuses.
 */
export function labelRulesOf(stored: Readonly<Record<string, unknown>>): LabelRules {
  const parsed = storedSchema.safeParse(stored);
  const value = parsed.success ? parsed.data : null;
  const lines = value?.lines ?? null;
  const origin = lines?.origin ?? null;
  return {
    fibre: { ...EMPTY, language: null, order: null, ...(lines?.fibre ?? {}) },
    care: lines?.care ?? { symbolCodes: [], source: null, confirmed: false },
    // The flat `origin` key and the `lines.origin` block describe one sentence; the block wins when both are set.
    origin: origin?.text !== undefined && origin?.text !== null ? origin : { ...EMPTY, text: value?.origin ?? null, source: origin?.source ?? null },
    size: lines?.size ?? EMPTY,
    importer: { ...EMPTY, required: null, ...(lines?.importer ?? {}) },
    cpsiaRequired: value?.cpsiaRequired ?? null,
    cpsiaSource: value?.cpsiaSource ?? null,
    label: value?.label ?? null,
  };
}
