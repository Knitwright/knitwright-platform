"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useOptimistic, useRef } from "react";
import { LinkButton } from "@/components/ui/LinkButton";
import type { AssistantInfo } from "@/components/studio/Editor";
import { SaveStatus } from "@/components/studio/EditorParts";
import { useEditor } from "@/components/studio/useEditor";
import { GUIDED_STEPS, guideAddress, neighbours, type StartMethod, type StepId } from "@/lib/guided/flow";
import type { EditorData } from "@/lib/projects/editor-data";
import type { LengthUnit } from "@/lib/units/length";
import { AdjustStep, DownloadStep, MakeStep, ReviewStep, StartStep } from "./GuidedSteps";
import { LivePreview } from "./LivePreview";
import { StepNav } from "./StepNav";

type Props = Readonly<{
  data: EditorData;
  step: StepId;
  from: StartMethod;
  say: string | undefined;
  unit: LengthUnit;
  assistant: AssistantInfo;
  /** The server switch SHOW_3D: the 3D trial under the drawing (decision 0027). */
  show3d?: boolean;
}>;

/**
 * The guided flow (plan step 15): start, review, adjust, download, then share and get it made,
 * with the drawing and the measurements in view at every step. Each step has its own address, so the browser's back
 * button works and a step can be shared. Focus moves to the step's heading when it changes.
 */
export function GuidedFlow({ data, step, from, say, unit, assistant, show3d = false }: Props) {
  const router = useRouter();
  const editor = useEditor(data);
  const heading = useRef<HTMLHeadingElement>(null);
  // The unit comes from the address. The choice shows at once, while the address changes.
  const [shownUnit, showUnit] = useOptimistic(unit);
  const chooseUnit = (chosen: LengthUnit): void =>
    startTransition(() => {
      showUnit(chosen);
      router.replace(guideAddress(data.projectId, step, { unit: chosen }) as Route);
    });
  const current = GUIDED_STEPS.find((entry) => entry.id === step) ?? GUIDED_STEPS[0];
  const { previous, next } = neighbours(step);
  const address = (to: StepId) => guideAddress(data.projectId, to, { unit, ...(to === step ? { from } : {}) }) as Route;

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  return (
    <div className="flex flex-col gap-3">
      <header className="glass flex flex-col gap-3 rounded-[1.75rem] px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:rounded-full lg:py-2 lg:pr-2 lg:pl-6">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-medium tracking-[-0.02em] text-ink">{data.name}</h1>
          <p className="truncate font-mono text-xs text-chalk-muted">
            {data.typeLabel} for {data.wearerLabel.toLowerCase()} · Version <span data-testid="version">{editor.state.version}</span>
          </p>
          <SaveStatus busy={editor.busy} status={editor.state.status} className="min-h-4 text-xs text-ink-2" />
        </div>
        <StepNav projectId={data.projectId} current={step} unit={unit} />
      </header>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="step-heading" className="glass @container flex min-w-0 flex-col gap-4 rounded-3xl p-6">
          <h2 id="step-heading" ref={heading} tabIndex={-1} className="text-xl font-medium tracking-[-0.02em] text-ink outline-none">
            {current.label}
          </h2>
          <p className="text-[15px] text-ink-2">{current.hint}</p>
          {step === "start" ? (
            <StartStep
              data={data}
              from={from}
              say={say}
              assistant={assistant}
              busy={editor.busy}
              onSaid={() => router.replace(address("start"))}
            />
          ) : null}
          {step === "review" ? <ReviewStep /> : null}
          {step === "adjust" ? <AdjustStep data={data} editor={editor} assistant={assistant} /> : null}
          {step === "download" ? <DownloadStep data={data} /> : null}
          {step === "make" ? <MakeStep data={data} /> : null}
          <div className="mt-2 flex flex-wrap gap-3">
            {previous ? (
              <LinkButton href={address(previous)} variant="secondary">
                Back
              </LinkButton>
            ) : null}
            {next ? <LinkButton href={address(next)}>Next: {GUIDED_STEPS.find((entry) => entry.id === next)?.label}</LinkButton> : null}
          </div>
        </section>
        <div className="min-w-0 lg:sticky lg:top-24">
          <LivePreview data={data} unit={shownUnit} onUnit={chooseUnit} show3d={show3d} />
        </div>
      </div>
    </div>
  );
}
