"use client";

import type { EditorData } from "@/lib/projects/editor-data";
import { ArtworkControls } from "./ArtworkControls";
import { ChatPanel } from "./ChatPanel";
import { ColourControls } from "./ColourControls";
import { ColourwayChooser } from "./ColourwayChooser";
import { DetailsForm } from "./DetailsForm";
import { DesignProblem, DroppedNotice, EditorHeader, SaveStatus, Section } from "./EditorParts";
import { FlatPreview } from "./FlatPreview";
import { History } from "./History";
import { ImageReview } from "./ImageReview";
import { BASE_KEY, NAMES_NUMBERS_KEY, SIZES_KEY, measurementKey } from "./keys";
import { MeasurementTables } from "./MeasurementTables";
import { NamesNumbersControls } from "./NamesNumbersControls";
import { OptionControls } from "./OptionControls";
import { SizesForm } from "./SizesForm";
import { HISTORY_KEY, useEditor, type Editor as EditorApi } from "./useEditor";

/*
 * Fabrics are part of the design but have no screen yet. They arrive with a later step.
 * The design keeps whatever they hold.
 */

type PartProps = Readonly<{ data: EditorData; editor: EditorApi }>;

/** What the page knows about the assistant. */
export type AssistantInfo = Readonly<{ available: boolean }>;

/** `show3d` is the server switch SHOW_3D: the 3D trial under the drawing (decision 0027). */
export function Editor({ data, assistant, show3d = false }: Readonly<{ data: EditorData; assistant: AssistantInfo; show3d?: boolean }>) {
  const editor = useEditor(data);
  const { state } = editor;

  return (
    <div className="flex flex-col gap-6">
      <EditorHeader data={data} version={state.version} busy={editor.busy} onUndo={editor.undo} />
      <SaveStatus busy={editor.busy} status={state.status} />
      <DesignProblem message={state.conflict ?? editor.errorFor(HISTORY_KEY)} conflict={state.conflict !== null} />
      <DroppedNotice dropped={state.dropped ?? data.dropped} />
      <FlatPreview flat={data.flat} show3d={show3d} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <MainColumn data={data} editor={editor} assistant={assistant} />
        <SideColumn data={data} editor={editor} assistant={assistant} />
      </div>
    </div>
  );
}

function MainColumn({ data, editor, assistant }: PartProps & Readonly<{ assistant: AssistantInfo }>) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Section id="picture" title="Start from a sketch or photo">
        <ImageReview projectId={data.projectId} version={data.version} available={assistant.available} busy={editor.busy} />
      </Section>
      <Section id="options" title="Options">
        <OptionControls
          controls={data.controls}
          choiceShown={editor.choiceShown}
          onChoose={editor.chooseOption}
          onSettle={editor.settleOption}
          errorFor={editor.errorFor}
        />
      </Section>
      <ColoursSection data={data} editor={editor} />
      <ArtworkSection data={data} editor={editor} />
      <Section id="names-numbers" title="Player names and numbers">
        <NamesNumbersControls
          panel={data.namesNumbers}
          error={editor.errorFor(NAMES_NUMBERS_KEY)}
          onSave={editor.saveAction}
          onProblem={(key, message) => editor.problem(key, message, false)}
          onClearProblem={editor.clearProblem}
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

function ColoursSection({ data, editor }: PartProps) {
  return (
    <Section id="colours" title="Colours">
      <p className="mb-4 text-[15px] leading-relaxed text-muted">
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
    </Section>
  );
}

function ArtworkSection({ data, editor }: PartProps) {
  return (
    <Section id="artwork" title="Logos and text">
      <ArtworkControls
        spec={editor.working}
        rows={data.artwork}
        parts={data.parts}
        errorFor={editor.errorFor}
        onSave={editor.saveAction}
        onProblem={(key, message) => editor.problem(key, message, false)}
        onClearProblem={editor.clearProblem}
      />
    </Section>
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

function SideColumn({ data, editor, assistant }: PartProps & Readonly<{ assistant: AssistantInfo }>) {
  return (
    <aside className="flex min-w-0 flex-col gap-6">
      <Section id="assistant" title="Assistant">
        <ChatPanel projectId={data.projectId} version={data.version} available={assistant.available} busy={editor.busy} />
      </Section>
      <Section id="history" title="History">
        <History
          entries={data.history}
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
