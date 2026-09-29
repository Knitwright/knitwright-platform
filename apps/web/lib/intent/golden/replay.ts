import { z } from "zod";
import {
  applyAction,
  cmToTenthsMm,
  createSpec,
  wearerSchema,
  type GarmentSpec,
} from "@/lib/garment";
import { isNeverSilent, type IntentOutcome } from "../outcome";
import { resolveIntent } from "../resolve";

/**
 * The golden set and its replay harness. A case is an instruction, the design it is given
 * against, and the outcome it should have. A recording holds one model reply per case.
 * Replaying runs each reply through the same parser the product uses, so no model is called.
 */

export const startSchema = z.strictObject({
  typeId: z.string(),
  wearer: wearerSchema.optional(),
  options: z.record(z.string(), z.string()).optional(),
  measurementsCm: z.record(z.string(), z.number()).optional(),
});
export type Start = z.output<typeof startSchema>;

const expectedSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("applied"),
    typeId: z.string().optional(),
    wearer: wearerSchema.optional(),
    options: z.record(z.string(), z.string()).optional(),
    /** Null means the measurement must be gone. */
    measurementsCm: z.record(z.string(), z.number().nullable()).optional(),
    colours: z.record(z.string(), z.string()).optional(),
    fabric: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    labelling: z.record(z.string(), z.string()).optional(),
  }),
  z.strictObject({ kind: z.literal("question") }),
  z.strictObject({ kind: z.literal("rejection") }),
]);
export type Expected = z.output<typeof expectedSchema>;

const caseSchema = z.strictObject({
  id: z.string(),
  category: z.string(),
  utterance: z.string(),
  start: startSchema,
  expected: expectedSchema,
  /** True only when the owner has approved this case (owner action A7). */
  approved: z.boolean(),
});
export type GoldenCase = z.output<typeof caseSchema>;

export const goldenSetSchema = z.strictObject({
  family: z.string(),
  status: z.enum(["proposed", "approved"]),
  note: z.string(),
  cases: z.array(caseSchema),
});

/** A reply as recorded: the raw text, or a JSON value to be sent as text. */
const replySchema = z.union([z.string(), z.json()]);
export type RecordedReply = z.output<typeof replySchema>;

export const recordingSchema = z.strictObject({
  /** True when the replies were written by hand rather than recorded from a model. */
  synthetic: z.boolean(),
  source: z.string(),
  responses: z.record(z.string(), replySchema),
  faults: z.array(
    z.strictObject({
      id: z.string(),
      utterance: z.string(),
      start: startSchema,
      expectedKind: z.enum(["applied", "question", "rejection"]),
      response: replySchema,
    }),
  ),
});

function must(spec: GarmentSpec, action: unknown): GarmentSpec {
  const result = applyAction(spec, action);
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
}

/** The design a case starts from. Its values are the person's own, so they are marked as typed in. */
export function startSpec(start: Start): GarmentSpec {
  const made = createSpec(start.typeId, start.wearer ?? "men");
  if (!made.ok) throw new Error(made.reason);
  const source = "user-edited";
  const withOptions = Object.entries(start.options ?? {}).reduce(
    (spec, [optionId, choiceId]) => must(spec, { type: "set-option", optionId, choiceId, provenance: source }),
    made.spec,
  );
  return Object.entries(start.measurementsCm ?? {}).reduce(
    (spec, [pointId, cm]) => must(spec, { type: "set-measurement", pointId, value: cmToTenthsMm(cm), provenance: source }),
    withOptions,
  );
}

/** Runs one recorded reply through the parser, exactly as a live reply would be. */
export function replayCase(entry: Pick<GoldenCase, "id" | "utterance" | "start">, reply: RecordedReply | undefined): IntentOutcome {
  const raw = typeof reply === "string" ? reply : (JSON.stringify(reply) ?? "");
  return resolveIntent({ utterance: entry.utterance, spec: startSpec(entry.start), raw });
}

export interface CaseScore {
  readonly id: string;
  readonly neverSilent: boolean;
  readonly correct: boolean;
  /** Null when the case does not score it. */
  readonly typeCorrect: boolean | null;
  readonly optionsCorrect: boolean | null;
  readonly problems: readonly string[];
}

function mismatches<T>(label: string, expected: Readonly<Record<string, T>> | undefined, actual: (key: string) => T | undefined): string[] {
  if (!expected) return [];
  const wrong = Object.entries(expected).filter(([key, value]) => actual(key) !== value);
  return wrong.length === 0 ? [] : [`${label}: expected ${JSON.stringify(Object.fromEntries(wrong))}`];
}

function appliedProblems(expected: Extract<Expected, { kind: "applied" }>, spec: GarmentSpec): { type: string[]; options: string[]; rest: string[] } {
  const type = expected.typeId !== undefined && expected.typeId !== spec.typeId ? [`type: expected ${expected.typeId}, got ${spec.typeId}`] : [];
  const options = mismatches("options", expected.options, (key) => spec.options[key]?.choiceId);
  const tenths = (key: string): number | null => spec.measurements.find((entry) => entry.pointId === key)?.value ?? null;
  const measurementsCm = Object.fromEntries(
    Object.entries(expected.measurementsCm ?? {}).map(([key, cm]) => [key, cm === null ? null : cmToTenthsMm(cm)]),
  );
  const colour = (panelId: string): string | undefined => {
    const entry = spec.colourways[0].colours.find((item) => item.panelId === panelId);
    return entry ? entry.colour || entry.swatch : undefined;
  };
  const fabric = spec.fabrics[0] as unknown as Readonly<Record<string, string | number>>;
  const rest = [
    ...(expected.wearer !== undefined && expected.wearer !== spec.wearer ? [`wearer: expected ${expected.wearer}, got ${spec.wearer}`] : []),
    ...mismatches("measurements", expected.measurementsCm ? measurementsCm : undefined, tenths),
    ...mismatches("colours", expected.colours, colour),
    ...mismatches("fabric", expected.fabric, (key) => fabric[key]),
    ...mismatches("labelling", expected.labelling, (key) => spec.labelling[key as keyof GarmentSpec["labelling"]]?.text),
  ];
  return { type, options, rest };
}

/** Compares an outcome with the proposed one: its kind, and for a change, each named field. */
export function scoreCase(entry: Pick<GoldenCase, "id" | "expected">, outcome: IntentOutcome): CaseScore {
  const neverSilent = isNeverSilent(outcome);
  const { expected } = entry;
  const scoresType = expected.kind === "applied" && expected.typeId !== undefined;
  const scoresOptions = expected.kind === "applied" && expected.options !== undefined;
  if (outcome.kind !== expected.kind) {
    return {
      id: entry.id,
      neverSilent,
      correct: false,
      typeCorrect: scoresType ? false : null,
      optionsCorrect: scoresOptions ? false : null,
      problems: [`expected ${expected.kind}, got ${outcome.kind}`],
    };
  }
  const found = expected.kind === "applied" && outcome.kind === "applied" ? appliedProblems(expected, outcome.spec) : { type: [], options: [], rest: [] };
  const problems = [...found.type, ...found.options, ...found.rest];
  return {
    id: entry.id,
    neverSilent,
    correct: neverSilent && problems.length === 0,
    typeCorrect: scoresType ? found.type.length === 0 : null,
    optionsCorrect: scoresOptions ? found.options.length === 0 : null,
    problems,
  };
}

/** Totals for a replay, so a live run can be recorded beside its cost (step 12). */
export function summarise(scores: readonly CaseScore[]) {
  const count = (test: (score: CaseScore) => boolean): number => scores.filter(test).length;
  return {
    total: scores.length,
    neverSilent: count((score) => score.neverSilent),
    correct: count((score) => score.correct),
    typeScored: count((score) => score.typeCorrect !== null),
    typeCorrect: count((score) => score.typeCorrect === true),
    optionsScored: count((score) => score.optionsCorrect !== null),
    optionsCorrect: count((score) => score.optionsCorrect === true),
  };
}
