"use client";

import type { Route } from "next";
import Link from "next/link";
import { ChatPanel } from "@/components/studio/ChatPanel";
import { ImageReview } from "@/components/studio/ImageReview";
import type { AssistantInfo } from "@/components/studio/Editor";
import { OptionControls } from "@/components/studio/OptionControls";
import type { Editor as EditorApi } from "@/components/studio/useEditor";
import { TechPackDownloads } from "@/components/techpack/TechPackDownloads";
import { LinkButton } from "@/components/ui/LinkButton";
import { withPlain } from "@/lib/copy/vocabulary";
import { startLead, type StartMethod } from "@/lib/guided/flow";
import { designActions } from "@/lib/projects/design-actions";
import type { EditorData } from "@/lib/projects/editor-data";

type Assistant = AssistantInfo;

type StartProps = Readonly<{
  data: EditorData;
  from: StartMethod;
  say: string | undefined;
  assistant: Assistant;
  busy: boolean;
  onSaid: () => void;
}>;

/** Step 1: the sentence is sent, or the picture is asked for. */
export function StartStep({ data, from, say, assistant, busy, onSaid }: StartProps) {
  if (from === "sketch") {
    return (
      <>
        <p className="text-[15px] leading-relaxed text-muted">
          Choose a sketch or photo. You will see what was read and tick each point before anything changes.
        </p>
        <ImageReview projectId={data.projectId} version={data.version} available={assistant.available} busy={busy} />
      </>
    );
  }
  return (
    <>
      <p className="text-[15px] leading-relaxed text-muted">{startLead(from, say, assistant.conversation.length)}</p>
      <ChatPanel
        projectId={data.projectId}
        version={data.version}
        available={assistant.available}
        busy={busy}
        conversation={assistant.conversation}
        initialUtterance={from === "text" ? say : undefined}
        onInitialSent={onSaid}
      />
    </>
  );
}

/** Step 2: the drawing and the table beside it are the review; this says what to look for. */
export function ReviewStep() {
  return (
    <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-2">
      <li>Is it the right garment, with the neck, sleeves and fit you want?</li>
      <li>A measurement marked &quot;Not given yet&quot; must be typed in before a factory can make the garment.</li>
      <li>Each value says where it came from, so you know which ones to check.</li>
    </ul>
  );
}

type AdjustProps = Readonly<{ data: EditorData; editor: EditorApi; assistant: Assistant }>;

/** Step 3: every option, and the assistant for anything else. */
export function AdjustStep({ data, editor, assistant }: AdjustProps) {
  return (
    <div className="flex flex-col gap-6">
      <OptionControls
        controls={data.controls}
        choiceShown={editor.choiceShown}
        onChoose={editor.chooseOption}
        onSettle={editor.settleOption}
        errorFor={editor.errorFor}
      />
      <ChatPanel projectId={data.projectId} version={data.version} available={assistant.available} busy={editor.busy} conversation={assistant.conversation} />
      <p className="text-sm text-muted">
        To type measurements, colours or logos,{" "}
        <Link href={`/studio/${data.projectId}` as Route} className="font-medium text-ink underline underline-offset-4">
          open the full editor
        </Link>
        .
      </p>
    </div>
  );
}

/** Step 4: the four files, made from the version shown. */
export function DownloadStep({ data }: Readonly<{ data: EditorData }>) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] leading-relaxed text-muted">
        Your {withPlain("tech pack")} as a PDF and a spreadsheet, and the front and back drawings as SVG files. They are
        made from version {data.version}.
      </p>
      <TechPackDownloads projectId={data.projectId} version={data.version} nested />
      <p className="text-sm text-muted">
        <Link href={`/studio/${data.projectId}/tech-pack` as Route} className="font-medium text-ink underline underline-offset-4">
          Read the whole {withPlain("tech pack")} on screen
        </Link>
      </p>
    </div>
  );
}

/** Step 5: no dead end. Each next step is a button with one sentence on what it does. */
export function MakeStep({ data }: Readonly<{ data: EditorData }>) {
  const actions = designActions(data.projectId);
  return (
    <ul className="flex flex-col divide-y divide-hairline" aria-label="What to do next">
      {actions.map((action, index) => (
        <li key={action.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
          <div>
            <LinkButton href={action.href as Route} variant={index === 0 ? "primary" : "secondary"}>
              {action.label}
            </LinkButton>
          </div>
          <p className="text-[15px] leading-relaxed text-muted">{action.sentence}</p>
        </li>
      ))}
    </ul>
  );
}
