import type { BaseArticle } from "@/lib/catalogue";
import type { GarmentSpec } from "@/lib/garment";
import { buildCallouts, buildQc } from "./callouts";
import { countProvenance, fromBase, fromDesign, type FieldProvenance, type ViewCell } from "./fields";
import { autoMapPlan, buildMeasurements, nextExtraLetter, type AutoMapPlan, type ExtraPom, type MeasurementMode, type MeasurementsView, type PomRow } from "./measurements";
import { extraPomsFrom, type SpecMark } from "./marks";
import { buildMaterials } from "./materials";
import { buildBody, buildOverview, type OverviewHeader } from "./overview";
import { buildReview, type ReviewView } from "./review";
import { section, tab, table, type TabView, type ViewTable } from "./rows";
import { buildArtworks, buildColourwaysTab, buildLabels, buildPersonalisation } from "./surfaces";
import { TECHPACK_TABS, type TechPackTabId } from "./tabs";
import { formatLength, type LengthUnit } from "./units";

/**
 * The whole tech pack view (spec F-S6), assembled from one design version and its base article.
 *
 * It is a pure function of what the editor's slot contract hands a panel (`lib/editor/slots.ts`):
 * the design, the base article, the shown size and colourway, the unit toggle, the Measurement |
 * Grading toggle and whatever the Specs toolbar has drawn. It fetches nothing and holds no state,
 * so the panel, the Excel export and the PDF export all read the same numbers from the same call.
 */

export type TechPackViewInput = Readonly<{
  spec: GarmentSpec;
  article: BaseArticle | null;
  header: OverviewHeader;
  /** The size the canvas is showing, highlighted in the measurement table beside the sample size. */
  size: string;
  sizes: readonly string[];
  colourwayId: string;
  /** What the Specs toolbar has drawn. Marks that measure become extra points of measure. */
  marks: readonly SpecMark[];
  /** Extra points of measure typed in with "+ Add measurement", which carry no grade. */
  extras: readonly ExtraPom[];
  unit: LengthUnit;
  mode: MeasurementMode;
}>;

export type TechPackView = Readonly<{
  unit: LengthUnit;
  mode: MeasurementMode;
  size: string;
  /** Every tab in spec order, Review last. */
  tabs: readonly TabView[];
  measurements: MeasurementsView;
  autoMap: AutoMapPlan;
  review: ReviewView;
  /** How many fields of the whole view carry each provenance chip, for the legend. */
  counts: Readonly<Record<FieldProvenance, number>>;
}>;

/**
 * The Measurements tab as a tab like the others, so the Review tab finds a point of measure with no
 * value the same way it finds any other empty field. The table's own shape is `MeasurementsView`;
 * this is the same rows read as cells.
 */
function measurementsTab(view: MeasurementsView): TabView {
  const columns = ["Letter", "Measurement", "Grade type", "Grade", "Tol −", "Tol +", ...view.columns.map((column) => column.size), "Rule"];
  return tab("measurements", [
    section({
      id: "poms",
      title: "Points of measure",
      note: view.note,
      tables: [
        table({
          id: "pom-rows",
          title: "Points of measure",
          columns,
          addLabel: "Add measurement",
          rows: view.rows.map((row) => ({ id: `pom-${row.letter}`, label: `${row.letter} ${row.description}`, cells: pomCells(row) })),
        }),
      ],
    }),
  ]);
}

/** One point of measure's row as cells. A locked cell is one the base article fixes. */
function pomCells(row: PomRow): readonly ViewCell[] {
  const at = (key: string) => `pom-${row.letter}-${key}`;
  const name = (what: string) => `${row.letter} ${row.description}: ${what}`;
  const base = (key: string, what: string, text: string | null): ViewCell =>
    row.isExtra
      ? fromDesign({ id: at(key), label: name(what), text, ruleId: row.ruleId })
      : fromBase({ id: at(key), label: name(what), text, ruleId: row.ruleId });
  return [
    base("letter", "letter", row.letter),
    base("description", "measurement", row.description),
    base("grade-type", "grade type", row.gradeTypeLabel),
    base("grade", "grade", row.grade),
    base("tol-minus", "lower tolerance", row.tolMinus),
    base("tol-plus", "upper tolerance", row.tolPlus),
    ...row.values.map((value) => base(`size-${value.size}`, `size ${value.size}`, value.text)),
    base("rule", "rule", row.ruleId),
  ];
}

/**
 * The founder's extras: the ones typed in with "+ Add measurement", then the ones the Specs toolbar
 * drew. Each takes the first letter the base article does not already use, so no extra point can
 * share a letter with one the factory grades.
 */
function extrasFor(input: TechPackViewInput, takenLetters: readonly string[]): readonly ExtraPom[] {
  const taken = [...takenLetters];
  const nextLetter = (): string => {
    const letter = nextExtraLetter(taken);
    taken.push(letter);
    return letter;
  };
  const typed = input.extras.map((extra) => (extra.letter.trim() === "" ? { ...extra, letter: nextLetter() } : extra));
  for (const extra of typed) if (!taken.includes(extra.letter)) taken.push(extra.letter);
  return [...typed, ...extraPomsFrom(input.marks, nextLetter)];
}

export function buildTechPackView(input: TechPackViewInput): TechPackView {
  const extras = extrasFor(input, (input.article?.poms ?? []).map((pom) => pom.letter));
  const measurements = buildMeasurements({ article: input.article, sizes: input.sizes, extras, mode: input.mode, unit: input.unit });
  const materials = buildMaterials(input.spec, input.article);
  const tabs: readonly TabView[] = [
    buildOverview(input.header, input.article),
    buildBody(input.article),
    measurementsTab(measurements),
    materials,
    buildCallouts(input.article, input.marks),
    buildArtworks(input.spec),
    buildColourwaysTab(input.spec, input.colourwayId),
    buildPersonalisation(input.article),
    buildLabels(input.spec),
    buildQc(input.article),
  ];
  const bomTables: readonly ViewTable[] = materials.sections.flatMap((part) => part.tables);
  const review = buildReview({ tabs, poms: measurements.rows, sizes: measurements.columns.map((column) => column.size), bomTables });
  return {
    unit: input.unit,
    mode: input.mode,
    size: input.size,
    tabs: [...tabs, reviewTab(review)],
    measurements,
    autoMap: autoMapPlan(input.article, measurements.rows),
    review,
    counts: countProvenance(tabs.flatMap((view) => view.sections.flatMap((part) => [...part.fields, ...part.tables.flatMap((entry) => entry.rows.flatMap((row) => row.cells))]))),
  };
}

/**
 * The Review tab's own entry in the tab bar. It holds no field of its own, because every field it
 * shows belongs to another tab: the panel draws `review` for it. Giving it fields would count the
 * same empty field twice.
 */
const reviewTab = (review: ReviewView): TabView =>
  tab("review", [section({ id: "review", title: "Still waiting for you", note: review.summary })]);

/** The tabs in the order the bar shows them, for a test that the view covers every one of them. */
export const tabIdsOf = (view: TechPackView): readonly TechPackTabId[] => view.tabs.map((entry) => entry.id);

export const ALL_TABS: readonly TechPackTabId[] = TECHPACK_TABS;

/** The live length the Specs toolbar shows while a line is being drawn, in the view's own unit. */
export const liveLength = (mm: number | null, unit: LengthUnit): string | null => formatLength(mm, unit);
