import { destinationGuards, oekoTexCertificate, type DestinationGuardInput, type FabricFacts, type Wearer } from "./guards";
import { blocker, GAP_RULE_ID, listOf, RULE_CARE_LABEL, type ComplianceFinding } from "./model";
import { labelRulesOf, type CareSymbol, type LabelRules } from "./rows";

/**
 * The label for one destination market (F-G3; `docs/spec/04-production-package.md`, section `07_labels`):
 * fibre composition in the required language and order, care symbols (ISO 3758), country of origin, size, and
 * an importer address where the market requires one. OEKO-TEX appears only where that fabric holds a
 * certificate.
 *
 * Every line is printed from a row that says where its words came from. A line whose row has no source, or no
 * words, is not printed at all: it becomes a gap with a rule id, and the F-G2 checklist refuses the export.
 * That is the whole point of this file. A care label is the one page of a tech pack a factory copies verbatim
 * onto a garment a person then wears, so an invented sentence here would leave the building.
 */

export const LABEL_LINE_KINDS = ["fibre", "care", "origin", "size", "importer", "certification"] as const;
export type LabelLineKind = (typeof LABEL_LINE_KINDS)[number];

export type LabelLine = Readonly<{
  kind: LabelLineKind;
  /** What the label says. Never empty: a line with nothing to say is a gap instead. */
  text: string;
  /** Where those words came from, quoted from the row. */
  source: string;
  /** False while nobody has confirmed the wording. The line still prints, carrying its label. */
  confirmed: boolean;
  ruleId: string;
}>;

export type DestinationLabel = Readonly<{
  /** ISO 3166 alpha-2, or EU. */
  country: string;
  countryName: string;
  /** The lines that may be printed, in label order. */
  lines: readonly LabelLine[];
  /** Everything missing or refused, each with the rule that explains it. */
  findings: readonly ComplianceFinding[];
  /** False while any finding is a blocker: the label may not go to a factory. */
  usable: boolean;
  /** The provenance label of the market's row, so a screen can show it beside the label. */
  label: string | null;
}>;

export interface DestinationLabelInput {
  readonly country: string;
  readonly countryName: string;
  readonly sellingEnabled: boolean;
  /** `country_rules.label_rules`, as stored. */
  readonly labelRules: Readonly<Record<string, unknown>>;
  readonly ruleId: string;
  readonly fabric: FabricFacts | null;
  readonly wearer: Wearer;
  /** The size run the label is printed for, in grading order. */
  readonly sizes: readonly string[];
  /** The importer or brand name and address the brand gave. Null: none given. */
  readonly importer: string | null;
  /** A CPSIA test certificate reference. Null everywhere today. */
  readonly cpsiaCertificate: string | null;
  /** The ISO 3758 rows, by code. */
  readonly careSymbols: readonly CareSymbol[];
}

const at = (country: string, part: string): string => `labels.${country.toLowerCase()}.${part}`;

const line = (kind: LabelLineKind, text: string, source: string, confirmed: boolean, ruleId: string): LabelLine => ({
  kind,
  text,
  source,
  confirmed,
  ruleId,
});

/** The fibre line: the market's own wording where it has one, else the fabric row's blend. */
function fibreLine(input: DestinationLabelInput, rules: LabelRules): Readonly<{ line: LabelLine | null; findings: readonly ComplianceFinding[] }> {
  const { fibre } = rules;
  const path = at(input.country, "fibre");
  const missing: ComplianceFinding[] = [];
  if (fibre.language === null || fibre.order === null) {
    missing.push(
      blocker(
        "fibre_order_unknown",
        path,
        `Nobody has written which language and which order ${input.countryName} needs the fibre content in.`,
        RULE_CARE_LABEL,
      ),
    );
  }
  const text = fibre.text ?? input.fabric?.blend ?? null;
  const source = fibre.text !== null ? fibre.source : input.fabric === null ? null : `programme_fabrics.blend for ${input.fabric.code}`;
  if (text === null || source === null) {
    missing.push(blocker("fibre_missing", path, `No fibre content is written for ${input.countryName}.`, RULE_CARE_LABEL));
    return { line: null, findings: missing };
  }
  return missing.length > 0 ? { line: null, findings: missing } : { line: line("fibre", text, source, fibre.confirmed, RULE_CARE_LABEL), findings: [] };
}

/** A care symbol may be printed only once it has a symbol reference, words and a source. */
const printable = (symbol: CareSymbol): boolean => symbol.symbolRef !== null && symbol.words !== null && symbol.source !== null;

/** The care line: the symbols the market's row names, every one of which must be a whole, sourced row. */
function careLine(input: DestinationLabelInput, rules: LabelRules): Readonly<{ line: LabelLine | null; findings: readonly ComplianceFinding[] }> {
  const path = at(input.country, "care");
  const codes = rules.care.symbolCodes;
  if (codes.length === 0) {
    return {
      line: null,
      findings: [blocker("care_symbols_missing", path, `No care symbols are chosen for ${input.countryName}. ISO 3758 is not transcribed in the platform yet.`, RULE_CARE_LABEL)],
    };
  }
  // The words come from the symbol rows, but *which* symbols a market's label carries is its own claim, and it
  // needs its own source. Without this a market could name five perfectly sourced symbols for no stated reason.
  if (rules.care.source === null) {
    return {
      line: null,
      findings: [
        blocker("care_choice_unsourced", path, `Nothing says why these care symbols are the ones ${input.countryName} needs.`, RULE_CARE_LABEL),
      ],
    };
  }
  const by = new Map(input.careSymbols.map((symbol) => [symbol.code, symbol]));
  const unusable = codes.filter((code) => {
    const symbol = by.get(code);
    return symbol === undefined || !printable(symbol);
  });
  if (unusable.length > 0) {
    return {
      line: null,
      findings: [
        blocker(
          "care_symbol_unsourced",
          path,
          `Care symbol ${listOf([...unusable])} has no symbol, no words or no source on file, so it may not go on a label.`,
          RULE_CARE_LABEL,
        ),
      ],
    };
  }
  const chosen = codes.map((code) => by.get(code)!);
  const text = chosen.map((symbol) => `${symbol.symbolRef} ${symbol.words}`).join(" · ");
  // Both halves: why these symbols, and where each one's words came from.
  const source = `${rules.care.source}; ${listOf([...new Set(chosen.map((symbol) => symbol.source!))])}`;
  return { line: line("care", text, source, rules.care.confirmed && chosen.every((symbol) => symbol.confirmed), RULE_CARE_LABEL), findings: [] };
}

/** A plain line whose words and source both come from one wording row. */
function wordingLine(
  kind: LabelLineKind,
  input: DestinationLabelInput,
  wording: Readonly<{ text: string | null; source: string | null; confirmed: boolean }>,
  code: string,
  because: string,
): Readonly<{ line: LabelLine | null; findings: readonly ComplianceFinding[] }> {
  if (wording.text === null || wording.source === null) {
    return { line: null, findings: [blocker(code, at(input.country, kind), because, RULE_CARE_LABEL)] };
  }
  return { line: line(kind, wording.text, wording.source, wording.confirmed, RULE_CARE_LABEL), findings: [] };
}

/** The size line. The market states the wording convention; the garment states which sizes it is printed for. */
function sizeLine(input: DestinationLabelInput, rules: LabelRules): Readonly<{ line: LabelLine | null; findings: readonly ComplianceFinding[] }> {
  const path = at(input.country, "size");
  if (input.sizes.length === 0) {
    return { line: null, findings: [blocker("size_run_missing", path, "The garment has no size run, so no size can be labelled.", RULE_CARE_LABEL)] };
  }
  return wordingLine(
    "size",
    input,
    rules.size,
    "size_wording_missing",
    `Nobody has written how a size is designated on a label for ${input.countryName}.`,
  );
}

/** The importer line, where the market requires one. A requirement nobody has recorded is a gap, not a pass. */
function importerLine(input: DestinationLabelInput, rules: LabelRules): Readonly<{ line: LabelLine | null; findings: readonly ComplianceFinding[] }> {
  const path = at(input.country, "importer");
  const { importer } = rules;
  if (importer.required === null) {
    return {
      line: null,
      findings: [blocker("importer_requirement_unknown", path, `Nobody has recorded whether ${input.countryName} needs an importer address on the label.`, GAP_RULE_ID)],
    };
  }
  if (!importer.required) return { line: null, findings: [] };
  const text = importer.text ?? input.importer;
  if (text === null) {
    return { line: null, findings: [blocker("importer_missing", path, `${input.countryName} needs an importer address and none is given.`, RULE_CARE_LABEL)] };
  }
  const source = importer.text !== null ? (importer.source ?? `country_rules.label_rules for ${input.country}`) : "The brand's own importer details";
  return { line: line("importer", text, source, importer.confirmed, RULE_CARE_LABEL), findings: [] };
}

/** The OEKO-TEX line, only where the fabric holds a certificate. */
function certificationLine(input: DestinationLabelInput): LabelLine | null {
  const certificate = oekoTexCertificate(input.fabric);
  return certificate === null
    ? null
    : line("certification", `OEKO-TEX Standard 100, ${certificate}`, `programme_fabrics.oeko_tex_cert for ${input.fabric!.code}`, false, GAP_RULE_ID);
}

const guardInput = (input: DestinationLabelInput, rules: LabelRules): DestinationGuardInput => ({
  country: input.country,
  countryName: input.countryName,
  sellingEnabled: input.sellingEnabled,
  cpsiaRequired: rules.cpsiaRequired,
  wearer: input.wearer,
  cpsiaCertificate: input.cpsiaCertificate,
  fabric: input.fabric,
  ruleId: input.ruleId,
});

/**
 * One destination's label. Deterministic: the same rows give the same lines, the same findings and the same
 * order every time.
 */
export function destinationLabel(input: DestinationLabelInput): DestinationLabel {
  const rules = labelRulesOf(input.labelRules);
  const parts = [
    fibreLine(input, rules),
    careLine(input, rules),
    wordingLine("origin", input, rules.origin, "origin_missing", `No country of origin is written for ${input.countryName}.`),
    sizeLine(input, rules),
    importerLine(input, rules),
  ];
  const certification = certificationLine(input);
  const lines = [...parts.flatMap((part) => (part.line === null ? [] : [part.line])), ...(certification === null ? [] : [certification])];
  const findings = [...destinationGuards(guardInput(input, rules)), ...parts.flatMap((part) => part.findings)];
  return {
    country: input.country,
    countryName: input.countryName,
    lines,
    findings,
    usable: !findings.some((found) => found.severity === "blocker"),
    label: rules.label,
  };
}

/** The labels for every destination asked for, in the order they were asked for. */
export const destinationLabels = (inputs: readonly DestinationLabelInput[]): readonly DestinationLabel[] => inputs.map(destinationLabel);

/** Only the lines a factory may print, with nothing unsourced among them. */
export const printableLines = (label: DestinationLabel): readonly LabelLine[] => (label.usable ? label.lines : []);
