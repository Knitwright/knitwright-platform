"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";
import { startWorkflowAction } from "@/lib/ai-studio/actions";
import { answeredSteps, checkAnswers, initialAnswers, type Answers } from "@/lib/ai-studio/answers";
import type { Availability } from "@/lib/ai-studio/availability";
import type { Tone } from "@/lib/ai-studio/catalogue";
import type { WorkflowForm } from "@/lib/ai-studio/forms";
import { FormField, type ProductOption } from "./Fields";
import { GenerateFooter, WorkflowFrame } from "./WorkflowFrame";

/**
 * A canvas workflow's page (decision 0141): the form drawn from its data, and Generate, which sets a
 * launch canvas up with the answers and opens it. The canvas runs each board with its cost shown
 * before anything is spent, so this page charges nothing. A failure says so, and that nothing was
 * spent (10 §8 "Toasts").
 */

export const FAILED_TOAST = { tone: "error", title: "Generation failed, no credits used" } as const;

export type FramedWorkflow = Readonly<{ id: string; title: string; lead: string; tone: Tone; poweredBy: string }>;

type Props = Readonly<{
  workflow: FramedWorkflow;
  form: WorkflowForm;
  products: readonly ProductOption[];
  availability: Availability;
  /** Credits one output costs when it runs on the canvas; 0 for a free workflow. */
  creditsPer: number;
  /** For a clip: credits a second, multiplied by the Duration answer instead of the count. */
  perSecond?: number;
  /** The button's words, such as "Generate" or "Open the canvas". */
  verb?: string;
  back?: boolean;
  initial?: Answers;
}>;

/** The cost on the button: "Free", or the credits the runs will cost (10 §9: shown before running). */
export const costLabel = (creditsPer: number, count: number): string => (creditsPer <= 0 ? "Free" : creditsPer * count === 1 ? "1 credit" : `${creditsPer * count} credits`);

const blockedReason = (availability: Availability, ok: boolean, first: string | undefined): string | null => {
  if (!availability.available) return availability.title;
  return ok ? null : (first ?? "Answer each step first.");
};

export function CanvasWorkflow({ workflow, form, products, availability, creditsPer, perSecond, verb = "Generate", back = true, initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [answers, setAnswers] = useState<Answers>({ ...initialAnswers(form), ...initial });
  const [count, setCount] = useState(form.count?.min ?? 1);
  const [shown, setShown] = useState<Readonly<Record<string, string>>>({});
  const [pending, setPending] = useState(false);

  const check = checkAnswers(form, answers, count);
  const first = check.ok ? undefined : Object.values(check.errors)[0];

  const generate = async (): Promise<void> => {
    if (!check.ok) return setShown(check.errors);
    setPending(true);
    const reply = await startWorkflowAction({ workflowId: workflow.id, projectId: answers.product, answers, count });
    if (reply.success) return router.push(reply.data.href as Route);
    setPending(false);
    toast.show({ ...FAILED_TOAST, body: reply.error.message, action: { label: "Retry", onAction: () => void generate() } });
  };

  const footer = (
    <GenerateFooter
      count={form.count ? { value: count, min: form.count.min, max: form.count.max, onChange: setCount } : undefined}
      label={form.count ? `${verb} ${count}` : verb}
      cost={perSecond === undefined ? costLabel(creditsPer, count) : costLabel(perSecond, Number(answers.seconds ?? 0))}
      blocked={blockedReason(availability, check.ok, first)}
      pending={pending}
      onGenerate={() => void generate()}
    />
  );

  return (
    <WorkflowFrame title={workflow.title} lead={workflow.lead} tone={workflow.tone} poweredBy={workflow.poweredBy} back={back} footer={footer}>
      {availability.available ? null : (
        <Notice tone="warn">
          <strong>{availability.title}.</strong> {availability.body}
        </Notice>
      )}
      <form
        className="flex flex-col gap-8"
        aria-describedby="workflow-progress"
        onSubmit={(event) => {
          event.preventDefault();
          void generate();
        }}
      >
        <p id="workflow-progress" className="sr-only">
          {answeredSteps(form, answers)} of {form.fields.filter((one) => one.kind !== "fixed").length} steps answered.
        </p>
        {form.fields.map((field, index) => (
          <FormField
            key={field.id}
            number={index + 1}
            field={field}
            value={answers[field.id] ?? ""}
            error={shown[field.id]}
            products={products}
            onChange={(value) => {
              setAnswers({ ...answers, [field.id]: value });
              setShown({});
            }}
          />
        ))}
        <p className="text-small text-muted">Generate opens your launch canvas with every board set up. Each board shows its cost before it runs, and nothing is charged until you run it.</p>
      </form>
    </WorkflowFrame>
  );
}
