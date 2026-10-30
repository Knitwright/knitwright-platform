import type { BaseArticle } from "@/lib/catalogue";
import type { GarmentSpec } from "@/lib/garment";
import { GAP_RULE } from "@/lib/kpp/model";
import { buildComponents } from "../components";
import { cell, fromBase, needsInput, type ViewCell } from "./fields";
import { fromCell, section, tab, table, type TabView, type ViewRow, type ViewTable } from "./rows";

/**
 * The **Materials (BOM)** tab (spec F-S6): sections Fabrics, Threads, Trims, Labels and Packaging,
 * each with a **+**, and the columns Description, Print / colour, Code, Quantity, Unit and Notes.
 *
 * Fabrics and threads come from the base article (X1 seeds `article_fabrics` and the thread spec
 * from `article.json`). Trims, labels and packaging come from the design, through the tech pack's
 * existing component lines, so a trim typed into the editor's own panel shows here without being
 * read twice from the design object.
 *
 * Spec F-S6 says trims and labels "can be added from the factory's list only". No factory list of
 * trims exists in the data yet (X6's factory model carries capabilities, not a trim catalogue), so
 * each of those three tables says plainly that nothing can be added until the factory's list is on
 * file, rather than offering a free-text box that would put an unorderable trim on a tech pack.
 */

const COLUMNS = ["Description", "Print / colour", "Code", "Quantity", "Unit", "Notes"] as const;

const NO_FACTORY_LIST = "The factory's own list of parts is not on file yet, so nothing can be added here.";
const NO_PACKAGING = "No packaging is on file for this base article yet. The fold and the bag come from the factory.";

type RowInit = Readonly<{
  id: string;
  label: string;
  description: string | null;
  printColour: string | null;
  code: string | null;
  quantity: string | null;
  unit: string | null;
  notes: string | null;
  ruleId: string;
  fromTheBase: boolean;
}>;

/** One bill-of-materials row: the same six cells in the same order whichever section it is in. */
function bomRow(init: RowInit): ViewRow {
  const make = (key: string, label: string, text: string | null): ViewCell =>
    init.fromTheBase && text !== null
      ? fromBase({ id: `${init.id}-${key}`, label: `${init.label}: ${label}`, text, ruleId: init.ruleId })
      : cell({ id: `${init.id}-${key}`, label: `${init.label}: ${label}`, text, provenance: "from_design", ruleId: init.ruleId });
  return {
    id: init.id,
    label: init.label,
    cells: [
      make("description", "description", init.description),
      make("print", "print or colour", init.printColour),
      make("code", "code", init.code),
      make("quantity", "quantity", init.quantity),
      make("unit", "unit", init.unit),
      make("notes", "notes", init.notes),
    ],
  };
}

const fabricRows = (article: BaseArticle | null): readonly ViewRow[] =>
  (article?.fabrics ?? []).map((fabric) =>
    bomRow({
      id: `fabric-${fabric.code}`,
      label: fabric.description ?? fabric.code,
      description: fabric.description,
      printColour: null,
      code: fabric.code,
      quantity: null,
      unit: fabric.widthCm === null ? null : `${fabric.widthCm} cm wide`,
      notes: fabric.gsm === null ? fabric.sourceNote : `${fabric.gsm} gsm`,
      ruleId: GAP_RULE,
      fromTheBase: true,
    }),
  );

const threadRows = (article: BaseArticle | null): readonly ViewRow[] => {
  const thread = article?.thread;
  if (!thread) return [];
  return [
    bomRow({
      id: "thread-needle",
      label: "Needle thread",
      description: thread.needle,
      printColour: null,
      code: null,
      quantity: null,
      unit: null,
      notes: null,
      ruleId: thread.ruleId,
      fromTheBase: true,
    }),
    bomRow({
      id: "thread-looper",
      label: "Looper thread",
      description: thread.looper,
      printColour: null,
      code: null,
      quantity: null,
      unit: null,
      notes: null,
      ruleId: thread.ruleId,
      fromTheBase: true,
    }),
  ];
};

/** The design's own component lines, which the existing tech pack already resolves from the registry. */
function componentRows(spec: GarmentSpec, kinds: readonly string[]): readonly ViewRow[] {
  return buildComponents(spec)
    .others.filter((line) => kinds.includes(line.kind) && !line.notUsed)
    .map((line) => ({
      id: `component-${line.slotId}`,
      label: line.label,
      cells: [
        fromCell({ id: `component-${line.slotId}-description`, label: `${line.label}: description`, ruleId: GAP_RULE }, line.name),
        needsInput({ id: `component-${line.slotId}-print`, label: `${line.label}: print or colour`, ruleId: GAP_RULE }),
        needsInput({ id: `component-${line.slotId}-code`, label: `${line.label}: code`, ruleId: GAP_RULE }),
        fromCell({ id: `component-${line.slotId}-quantity`, label: `${line.label}: quantity`, ruleId: GAP_RULE }, line.quantity),
        needsInput({ id: `component-${line.slotId}-unit`, label: `${line.label}: unit`, ruleId: GAP_RULE }),
        fromCell({ id: `component-${line.slotId}-notes`, label: `${line.label}: notes`, ruleId: GAP_RULE }, line.details),
      ],
    }));
}

const bomTable = (id: string, title: string, rows: readonly ViewRow[], note: string | null): ViewTable =>
  table({ id, title, columns: [...COLUMNS], rows, addLabel: null, note: rows.length === 0 ? (note ?? NO_FACTORY_LIST) : note });

export function buildMaterials(spec: GarmentSpec, article: BaseArticle | null): TabView {
  return tab("materials", [
    section({
      id: "bom",
      title: "Bill of materials",
      tables: [
        bomTable("fabrics", "Fabrics", fabricRows(article), null),
        // The base's needle and looper thread, then whatever the design says about thread itself,
        // so a note typed into the editor's own panel is not dropped on the way to the factory.
        bomTable("threads", "Threads", [...threadRows(article), ...componentRows(spec, ["thread"])], null),
        bomTable("trims", "Trims", componentRows(spec, ["trim", "rib"]), NO_FACTORY_LIST),
        bomTable("labels", "Labels", componentRows(spec, ["label"]), NO_FACTORY_LIST),
        bomTable("packaging", "Packaging", [], NO_PACKAGING),
      ],
    }),
  ]);
}
