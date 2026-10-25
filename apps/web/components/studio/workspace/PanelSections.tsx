"use client";

import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { panelsFor } from "@/lib/garment";
import type { EditorData } from "@/lib/projects/editor-data";
import type { SectionId } from "@/lib/workspace/tools";
import { CommentsPanel } from "@/components/comments/CommentsPanel";
import { VariantsPanel } from "@/components/variants/VariantsPanel";
import { ProductionPanel } from "@/components/production/ProductionPanel";
import { ArtworkControls } from "../ArtworkControls";
import { ColourControls } from "../ColourControls";
import { ColourwayChooser } from "../ColourwayChooser";
import { DetailsForm } from "../DetailsForm";
import { Section } from "../EditorParts";
import { History } from "../History";
import { ImageReview } from "../ImageReview";
import { BASE_KEY, NAMES_NUMBERS_KEY, SIZES_KEY, measurementKey } from "../keys";
import { MeasurementTables } from "../MeasurementTables";
import { NamesNumbersControls } from "../NamesNumbersControls";
import { OptionControls } from "../OptionControls";
import { SizesForm } from "../SizesForm";
import type { Editor as EditorApi } from "../useEditor";
import { FabricSummary, LabellingSummary, TrimSummary } from "./FactorySummaries";

/** Parts drawn on the server and handed to the workspace: they read the database themselves. */
export type WorkspaceSlots = Readonly<{
  kitStyles: ReactNode;
  share: ReactNode;
  photoreal: ReactNode;
  quote: ReactNode;
  /** A question for the person beside the assistant, such as who the design is for. */
  organisation: ReactNode;
}>;

export type SectionContext = Readonly<{
  data: EditorData;
  editor: EditorApi;
  assistantAvailable: boolean;
  slots: WorkspaceSlots;
}>;

const LEAD = "text-[15px] leading-relaxed text-muted";

/** The heading of each section, or null where the panel's own heading says it all. */
const sectionTitle = (section: SectionId, data: EditorData): string | null => {
  switch (section) {
    case "options":
      return "Options";
    case "picture":
      return "Start from a sketch or photo";
    case "details":
      return "Design details";
    case "colours":
      return "Part colours";
    case "sizes":
      return "Sizes";
    case "measurements":
      return data.table.size ? `Measurements for size ${data.table.size}` : "Measurements";
    case "fabrics":
      return "Fabrics";
    case "trims":
      return "Thread, labels, rib and trims";
    default:
      return null;
  }
};

/** One section of a tool panel, with its heading. The controls are the editor's own. */
export function PanelSection({ section, context }: Readonly<{ section: SectionId; context: SectionContext }>) {
  const body = sectionBody(section, context);
  if (body === null) return null;
  return (
    <Section id={`section-${section}`} title={sectionTitle(section, context.data)}>
      {body}
    </Section>
  );
}

function sectionBody(section: SectionId, context: SectionContext): ReactNode {
  const { data, editor, slots } = context;
  switch (section) {
    case "options":
      return (
        <OptionControls
          controls={data.controls}
          choiceShown={editor.choiceShown}
          onChoose={editor.chooseOption}
          onSettle={editor.settleOption}
          errorFor={editor.errorFor}
        />
      );
    case "picture":
      return <ImageReview projectId={data.projectId} version={data.version} available={context.assistantAvailable} busy={editor.busy} />;
    case "details":
      return <DetailsSection data={data} />;
    case "kit-styles":
      return slots.kitStyles ?? null;
    case "colours":
      return <ColoursSection context={context} />;
    case "sizes":
      return <SizesSection context={context} />;
    case "measurements":
      return <MeasurementsSection context={context} />;
    case "fabrics":
      return <FabricSummary projectId={data.projectId} spec={data.spec} />;
    case "trims":
      return <TrimSummary projectId={data.projectId} spec={data.spec} />;
    case "artwork":
      return (
        <ArtworkControls
          spec={editor.working}
          rows={data.artwork}
          parts={data.parts}
          errorFor={editor.errorFor}
          onSave={editor.saveAction}
          onProblem={(key, message) => editor.problem(key, message, false)}
          onClearProblem={editor.clearProblem}
        />
      );
    case "names-numbers":
      return (
        <NamesNumbersControls
          panel={data.namesNumbers}
          error={editor.errorFor(NAMES_NUMBERS_KEY)}
          onSave={editor.saveAction}
          onProblem={(key, message) => editor.problem(key, message, false)}
          onClearProblem={editor.clearProblem}
        />
      );
    case "labelling":
      return <LabellingSummary projectId={data.projectId} spec={data.spec} />;
    case "variants":
      return <VariantsPanel projectId={data.projectId} version={data.version} busy={editor.busy} />;
    case "comments":
      return <CommentsPanel projectId={data.projectId} version={data.version} panels={panelsFor(data.spec).map((p) => ({ id: p.id, label: p.label }))} />;
    case "history":
      return <History entries={data.history} olderHidden={data.olderVersionsHidden} busy={editor.busy} onRestore={editor.restore} />;
    case "production":
      return <ProductionPanel />;
    case "share":
    case "photoreal":
    case "quote":
      return slots[section] ?? null;
  }
}

function DetailsSection({ data }: Readonly<{ data: EditorData }>) {
  return (
    <>
      <DetailsForm projectId={data.projectId} name={data.name} styleNumber={data.styleNumber} season={data.season} />
      <p>
        <Link href={`/studio/${data.projectId}/delete` as Route} className="text-sm text-muted underline hover:text-ink">
          Delete design
        </Link>
      </p>
    </>
  );
}

function ColoursSection({ context: { data, editor } }: Readonly<{ context: SectionContext }>) {
  return (
    <>
      <p className={LEAD}>
        The drawn colour only sets how the drawing looks, and a factory needs a colour name or code as well, so type one
        if you have it. A part with no drawn colour is shown in light grey.
      </p>
      <ColourwayChooser choices={data.colourways} />
      <ColourControls
        rows={data.colours}
        errorFor={editor.errorFor}
        onPickSwatch={editor.pickSwatch}
        onSettleSwatch={editor.settleSwatch}
        onChangeText={editor.changeColour}
        onTyping={editor.clearProblem}
        onDirty={editor.markDirty}
      />
    </>
  );
}

function SizesSection({ context: { data, editor } }: Readonly<{ context: SectionContext }>) {
  return (
    <>
      <p className={LEAD}>
        {data.sizes.set
          ? "The measurements below are for the base size. The other sizes are worked out from it."
          : "Add the sizes you will make. The measurements below are for the base size."}
      </p>
      <SizesForm
        initialText={data.sizes.text}
        initialBase={data.sizes.baseSize}
        isSet={data.sizes.set}
        busy={editor.busy}
        errorFor={editor.errorFor}
        onInvalid={(key, message) => editor.problem(key, message, true)}
        onSave={editor.saveSizes}
        onTyping={() => {
          editor.clearProblem(SIZES_KEY);
          editor.clearProblem(BASE_KEY);
        }}
        onDirty={editor.markDirty}
      />
    </>
  );
}

function MeasurementsSection({ context: { data, editor } }: Readonly<{ context: SectionContext }>) {
  return (
    <>
      <p className={LEAD}>
        Lengths are in centimetres. Type a value to use your own. It is then marked as typed in by you. Empty a field to
        remove your value.
      </p>
      <MeasurementTables
        table={data.table}
        errorFor={editor.errorFor}
        onEdit={editor.editMeasurement}
        onReset={editor.resetMeasurement}
        onTyping={(pointId) => editor.clearProblem(measurementKey(pointId))}
        onDirty={editor.markDirty}
      />
    </>
  );
}
