"use client";

import type { EditorData } from "@/lib/projects/editor-data";
import { DetailsForm } from "./DetailsForm";
import { DesignProblem, DroppedNotice, EditorHeader, SaveStatus, Section } from "./EditorParts";
import { History } from "./History";
import { BASE_KEY, SIZES_KEY, measurementKey } from "./keys";
import { MeasurementTables } from "./MeasurementTables";
import { OptionControls } from "./OptionControls";
import { SizesForm } from "./SizesForm";
import { HISTORY_KEY, useEditor, type Editor as EditorApi } from "./useEditor";

/*
 * Fabrics, colourways and artwork are part of the design but have no screen yet. They
 * arrive with later steps. The design keeps whatever they hold.
 */

type PartProps = Readonly<{ data: EditorData; editor: EditorApi }>;

export function Editor({ data }: Readonly<{ data: EditorData }>) {
  const editor = useEditor(data);
  const { state } = editor;

  return (
    <div className="flex flex-col gap-6">
      <EditorHeader data={data} busy={editor.busy} onUndo={editor.undo} />
      <SaveStatus busy={editor.busy} status={state.status} />
      <DesignProblem message={state.conflict ?? editor.errorFor(HISTORY_KEY)} conflict={state.conflict !== null} />
      <DroppedNotice dropped={state.dropped ?? data.dropped} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <MainColumn data={data} editor={editor} />
        <SideColumn data={data} editor={editor} />
      </div>
    </div>
  );
}

function MainColumn({ data, editor }: PartProps) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Section id="options" title="Options">
        <OptionControls
          controls={data.controls}
          choiceShown={editor.choiceShown}
          onChoose={editor.chooseOption}
          onSettle={editor.settleOption}
          errorFor={editor.errorFor}
        />
      </Section>
      <Section id="sizes" title="Sizes">
        <SizesSection data={data} editor={editor} />
      </Section>
      <Section id="measurements" title={data.table.size ? `Measurements for size ${data.table.size}` : "Measurements"}>
        <p className="mb-4 text-[15px] leading-relaxed text-muted">
          Lengths are in centimetres. Type a value to use your own. It is then marked as typed in by you. Empty a
          field to remove your value.
        </p>
        <MeasurementTables
          table={data.table}
          errorFor={editor.errorFor}
          onEdit={editor.editMeasurement}
          onReset={editor.resetMeasurement}
          onTyping={(pointId) => editor.clearProblem(measurementKey(pointId))}
          onDirty={editor.markDirty}
        />
      </Section>
    </div>
  );
}

function SizesSection({ data, editor }: PartProps) {
  return (
    <>
      <p className="mb-4 text-[15px] leading-relaxed text-muted">
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
        onDirty={(dirty) => editor.markDirty("sizes", dirty)}
      />
    </>
  );
}

function SideColumn({ data, editor }: PartProps) {
  return (
    <aside className="flex min-w-0 flex-col gap-6">
      <Section id="history" title="History">
        <History
          versions={data.versions}
          olderHidden={data.olderVersionsHidden}
          busy={editor.busy}
          onRestore={editor.restore}
        />
      </Section>
      <Section id="details" title="Design details">
        <DetailsForm
          projectId={data.projectId}
          name={data.name}
          styleNumber={data.styleNumber}
          season={data.season}
        />
      </Section>
    </aside>
  );
}
