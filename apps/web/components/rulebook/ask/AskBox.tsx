"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { askRulebookAction } from "@/lib/rulebook/ask/actions";
import { MAX_QUESTION_LENGTH } from "@/lib/rulebook/ask/prompt";
import type { AskResult } from "@/lib/rulebook/ask/types";
import { AskAnswer } from "./AskAnswer";
import { askBoxProps } from "./a11y";

/**
 * The Ask box (spec F-S5 v2), scoped to the design it sits beside: the base article and the way it is made are
 * sent with the question, so a rule scoped to one method is never handed to a design made another way.
 *
 * The answer is read out by a screen reader when it arrives, and every sentence carries the "Why?" link of the
 * rule it restates. Nothing a model wrote reaches this component unless the grader passed it.
 */
export function AskBox({ articleCode, method }: Readonly<{ articleCode?: string; method?: string }>) {
  const { form, submit, pending, summary, state, fieldErrors } = useFormAction<AskResult>(askRulebookAction);
  const result = state.result?.success ? state.result.data : null;
  const ids = askBoxProps(pending);

  return (
    <section className="flex flex-col gap-3" aria-labelledby={ids.headingId}>
      <h2 id={ids.headingId} className="font-semibold text-ink">
        Ask about this design
      </h2>
      <form ref={form} action={submit} noValidate className="flex flex-col gap-3" data-testid="ask-form">
        <FormSummary message={summary} />
        <input type="hidden" name="articleCode" value={articleCode ?? ""} />
        <input type="hidden" name="method" value={method ?? ""} />
        <Field
          name="question"
          label="Your question"
          hint="Knitwright answers out of its rulebook and names the rule each sentence comes from."
          maxLength={MAX_QUESTION_LENGTH}
          errors={fieldErrors("question")}
        />
        <div>
          <Button type="submit" variant="secondary" pending={pending}>
            {pending ? "Looking in the rulebook" : "Ask"}
          </Button>
        </div>
      </form>
      <div {...ids.answerProps}>{result ? <AskAnswer result={result} /> : null}</div>
    </section>
  );
}
