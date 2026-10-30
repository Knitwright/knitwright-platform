import type { BaseArticle } from "@/lib/catalogue";
import { GAP_RULE } from "@/lib/kpp/model";
import { fromBase, fromDesign, needsInput, type ViewCell } from "./fields";
import type { SpecMark } from "./marks";
import { section, tab, table, type TabView, type ViewRow } from "./rows";

/**
 * The **Callouts** and **QC** tabs (spec F-S6).
 *
 * Callouts: the numbered construction notes, as the base article's construction table gives them,
 * with the **Callout | References** toggle. The construction itself is locked (spec F-S6: "Founders
 * can add notes and reference images; construction itself is locked"), so each row carries the
 * base's own rule id and the panel draws a lock and a "Why?" on it. A callout the Specs toolbar
 * drew is the founder's own note and sits under the base's rows, numbered on from them.
 *
 * QC: read-only from the base, says spec F-S6. The base article catalogue holds no QC plan — X1
 * seeded `base_articles`, `article_poms`, `parameter_defs`, `option_defs`, `article_construction`
 * and `article_fabrics`, and `article.json`'s `qc` block is not among them. So the tab names the
 * four things the spec asks for, says each is not on file, and carries `R-QC-001`, the rulebook's
 * own QC rule, so the "Why?" opens the rule rather than a gap.
 */

export const CALLOUT_MODES = ["callout", "references"] as const;
export type CalloutMode = (typeof CALLOUT_MODES)[number];
export const CALLOUT_MODE_LABELS: Readonly<Record<CalloutMode, string>> = { callout: "Callout", references: "References" };

const NO_CONSTRUCTION = "No construction table is on file for this base article yet, so it has no callouts.";
const QC_RULE = "R-QC-001";
const NOT_ON_FILE = "This is not on file for this base article yet. It comes from the factory with the signed pattern.";

const calloutRow = (step: number, seam: string, operation: string, spi: string | null, ruleId: string): ViewRow => ({
  id: `callout-${step}`,
  label: `${step} ${seam}`,
  cells: [
    fromBase({ id: `callout-${step}-number`, label: `Callout ${step}: number`, text: String(step), ruleId }),
    fromBase({ id: `callout-${step}-seam`, label: `Callout ${step}: seam`, text: seam, ruleId }),
    fromBase({ id: `callout-${step}-operation`, label: `Callout ${step}: operation`, text: operation, ruleId }),
    fromBase({ id: `callout-${step}-spi`, label: `Callout ${step}: stitches per inch`, text: spi, ruleId }),
  ],
});

/** A callout the Specs toolbar drew: the founder's own note, numbered on from the base's rows. */
const markRow = (mark: SpecMark, number: number): ViewRow => ({
  id: `callout-${mark.id}`,
  label: `${number} ${mark.label}`,
  cells: [
    fromDesign({ id: `callout-${mark.id}-number`, label: `Callout ${number}: number`, text: String(number), ruleId: GAP_RULE }),
    fromDesign({ id: `callout-${mark.id}-seam`, label: `Callout ${number}: where`, text: mark.label, ruleId: GAP_RULE }),
    fromDesign({ id: `callout-${mark.id}-operation`, label: `Callout ${number}: note`, text: mark.note, ruleId: GAP_RULE }),
    needsInput({ id: `callout-${mark.id}-spi`, label: `Callout ${number}: stitches per inch`, ruleId: GAP_RULE }),
  ],
});

export function buildCallouts(article: BaseArticle | null, marks: readonly SpecMark[]): TabView {
  const steps = article?.construction ?? [];
  const drawn = marks.filter((mark) => mark.tool === "callout");
  const rows = [
    ...steps.map((step) => calloutRow(step.step, step.seam, step.operation, step.spi, step.ruleId)),
    ...drawn.map((mark, index) => markRow(mark, steps.length + index + 1)),
  ];
  return tab("callouts", [
    section({
      id: "callouts",
      title: "Construction callouts",
      note: rows.length === 0 ? NO_CONSTRUCTION : null,
      tables: [
        table({
          id: "callout-rows",
          title: "Callouts",
          columns: ["#", "Seam", "Operation", "SPI"],
          rows,
          addLabel: "Add a callout with the Specs toolbar",
        }),
      ],
    }),
    section({
      id: "references",
      title: "Reference images",
      note: "A reference image is uploaded in the Library toolbar; none is attached to a callout yet.",
      fields: drawn.map((mark) => needsInput({ id: `reference-${mark.id}`, label: `Reference image for ${mark.label}`, ruleId: GAP_RULE })),
    }),
  ]);
}

const qcFields = (article: BaseArticle | null): readonly ViewCell[] => [
  needsInput({ id: "qc-aql", label: "Inspection plan", ruleId: QC_RULE }),
  article && article.poms.length > 0
    ? fromBase({
        id: "qc-measure",
        label: "Points of measure to check",
        text: article.poms.map((pom) => pom.letter).join(", "),
        ruleId: QC_RULE,
      })
    : needsInput({ id: "qc-measure", label: "Points of measure to check", ruleId: QC_RULE }),
  needsInput({ id: "qc-colour", label: "Colour check", ruleId: QC_RULE }),
  needsInput({ id: "qc-photos", label: "Photographs for every order", ruleId: QC_RULE }),
];

export function buildQc(article: BaseArticle | null): TabView {
  return tab("qc", [
    section({ id: "qc", title: "Quality control", note: NOT_ON_FILE, fields: qcFields(article) }),
  ]);
}
