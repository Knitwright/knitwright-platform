"use client";

import { useMemo, useState } from "react";
import { usePreferredLengthUnit } from "@/components/units/LengthUnitContext";
import type { BaseArticle } from "@/lib/catalogue";
import type { GarmentSpec, SpecAction } from "@/lib/garment";
import { checkFit } from "@/lib/techpack/editor/fit";
import { buildSheets, sheetsFileName, type SheetId } from "@/lib/techpack/editor/sheets";
import { stageCallouts, stagePoints } from "@/lib/techpack/editor/stage";
import { foldTabs, type EditorTabId } from "@/lib/techpack/editor/tabs";
import { makeMark, markSaveKey, marksOf, removeMarkAction, saveMarkAction, type PickedPoint } from "@/lib/techpack/view/marks";
import type { ExtraPom, MeasurementMode } from "@/lib/techpack/view/measurements";
import { buildTechPackView } from "@/lib/techpack/view/model";
import type { OverviewHeader } from "@/lib/techpack/view/overview";
import type { LengthUnit } from "@/lib/techpack/view/units";
import { Panel } from "./Panel";
import { SheetsModal } from "./SheetsModal";
import { Stage } from "./Stage";
import { Garment, StageMarks, type StageSelection } from "./StageMarks";

/**
 * THE TECH PACK EDITOR (plan v6 G2, spec 09 screens 30 and 31, decision 0151): the Garment Studio's
 * Tech pack view. The stage shows the garment with its red points A, B, C … and blue numbered
 * callouts; the panel beside it has the seven tabs, mm / cm / in, Check fit and Preview sheets.
 *
 * It is self-contained, so it is mounted the same way by the `/studio/<id>/tech-pack` page and by
 * the editor's Tech pack slot (and by G1's 2D / 3D / Tech pack switch through either). It fetches
 * nothing: every value is `buildTechPackView` over the design and its base article, so the panel,
 * the sheets preview and the .xlsx carry the same numbers. A callout added on the stage is saved
 * through `onSave`, the same stored-design action the Specs toolbar uses.
 */

export type SheetsSettings = Readonly<{
  date: string;
  openIn: string;
  downloads: Readonly<{ xlsx: string; pdf: string }> | null;
  canExport: boolean;
}>;

export type TechPackEditorProps = Readonly<{
  spec: GarmentSpec;
  article: BaseArticle | null;
  header: OverviewHeader;
  /** The sizes the design comes in; the article's own range when not given. */
  sizes?: readonly string[];
  size?: string;
  colourwayId?: string;
  /** The unit to open in; the person's own setting (decision 0144) when not given. */
  unit?: LengthUnit;
  tab?: EditorTabId;
  /** Opens the sheets preview at once, on this sheet (a fixture, or a link from the Export panel). */
  openSheet?: SheetId;
  /** Saves a change to the design, or null where nothing can be saved (a fixture). */
  onSave: ((key: string, action: SpecAction) => void) | null;
  busy: boolean;
  /** Told when the size changes, so the frame around the editor can follow it. */
  onSize?: (size: string) => void;
  sheets: SheetsSettings;
}>;

const calloutMark = (point: PickedPoint, note: string) =>
  makeMark({
    id: `stage-${Date.now().toString(36)}`,
    tool: "callout",
    label: note.slice(0, 60),
    note: note.length > 60 ? note : null,
    points: [point],
    drawnOn: "3d",
  });

/** The line under the panel: where the graded sizes come from, never a rule the catalogue does not hold. */
const footnoteOf = (article: BaseArticle | null): string =>
  article
    ? `Every value comes from the design and base article ${article.code}. Graded sizes follow its size run, sample size ${article.sampleSize ?? "not on file"}.`
    : "This design is not on a base article the catalogue covers yet, so it has no graded sizes.";

export function TechPackEditor(props: TechPackEditorProps) {
  const { spec, article, onSave } = props;
  const given = props.sizes;
  const sizes = useMemo(() => (given && given.length > 0 ? given : (article?.sizeRange ?? [])), [given, article]);
  const [tab, setTab] = useState<EditorTabId>(props.tab ?? "overview");
  const preferred = usePreferredLengthUnit();
  const [unit, setUnit] = useState<LengthUnit>(props.unit ?? preferred);
  const [mode, setMode] = useState<MeasurementMode>("measurement");
  const [size, setSize] = useState(props.size ?? article?.sampleSize ?? sizes[0] ?? "");
  const [extras, setExtras] = useState<readonly ExtraPom[]>([]);
  const [selection, setSelection] = useState<StageSelection>(null);
  const [placing, setPlacing] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(props.openSheet !== undefined);

  const marks = useMemo(() => marksOf(spec), [spec]);
  const colourwayId = props.colourwayId ?? spec.colourways[0]?.id ?? "";
  const view = useMemo(
    () =>
      buildTechPackView({
        spec,
        article,
        header: props.header,
        size,
        sizes,
        colourwayId,
        marks,
        extras,
        unit,
        mode,
      }),
    [spec, article, props.header, size, sizes, colourwayId, marks, extras, unit, mode],
  );
  const tabs = useMemo(() => foldTabs(view.tabs), [view.tabs]);
  const points = useMemo(() => stagePoints(view.measurements.rows), [view.measurements.rows]);
  const callouts = useMemo(() => stageCallouts(article, marks), [article, marks]);
  const fit = useMemo(() => checkFit(article, sizes), [article, sizes]);

  const select = (next: StageSelection) => {
    setSelection(next);
    if (next?.kind === "point") setTab("measurements");
    if (next?.kind === "callout") setTab("callouts");
  };
  const chooseSize = (next: string) => {
    setSize(next);
    props.onSize?.(next);
  };
  const place = (point: PickedPoint, note: string) => {
    const mark = calloutMark(point, note);
    const action = mark ? saveMarkAction(mark) : null;
    if (mark && action && onSave) onSave(markSaveKey(mark.id), action);
    setPlacing(false);
  };
  const remove = (markId: string) => {
    const mark = marks.find((entry) => entry.id === markId);
    if (mark && onSave) onSave(markSaveKey(mark.id), removeMarkAction(mark));
    setSelection(null);
  };
  const drawing = (
    <svg viewBox="0 0 400 480" role="img" aria-label="Front view with the points of measure" className="mx-auto h-80">
      <Garment />
      <StageMarks points={points.drawn} callouts={[]} selection={null} onSelect={() => undefined} />
    </svg>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row" data-testid="techpack-editor">
      <Stage
        points={points}
        callouts={callouts}
        selection={selection}
        onSelect={select}
        fit={fit}
        sizes={sizes}
        size={size}
        onSize={chooseSize}
        placing={placing}
        onPlace={place}
        onCancelPlace={() => setPlacing(false)}
        onRemoveCallout={onSave ? remove : null}
        busy={props.busy}
      />
      <Panel
        tabs={tabs}
        tab={tab}
        onTab={setTab}
        unit={unit}
        onUnit={setUnit}
        view={view}
        size={size}
        selection={selection}
        onSelect={select}
        callouts={callouts}
        onMode={setMode}
        onAddMeasurement={(extra) => setExtras((all) => [...all, extra])}
        onAddCallout={onSave ? () => setPlacing(true) : null}
        onRemoveCallout={onSave ? remove : null}
        busy={props.busy}
        onPreview={() => setSheetsOpen(true)}
        footnote={footnoteOf(article)}
      />
      {sheetsOpen ? (
        <SheetsModal
          open
          onClose={() => setSheetsOpen(false)}
          sheets={buildSheets({
            view,
            header: props.header,
            article,
            date: props.sheets.date,
            openIn: props.sheets.openIn,
          })}
          fileName={sheetsFileName(props.header)}
          downloads={props.sheets.downloads}
          canExport={props.sheets.canExport}
          drawing={drawing}
          sheet={props.openSheet}
        />
      ) : null}
    </div>
  );
}
