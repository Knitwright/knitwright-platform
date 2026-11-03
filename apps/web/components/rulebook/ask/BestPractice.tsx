"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { bestPracticeAction } from "@/lib/rulebook/ask/actions";
import type { BestPracticeCard as Card } from "@/lib/rulebook/ask/types";
import { bestPracticePickerProps } from "./a11y";
import { BestPracticeCard } from "./BestPracticeCard";
import { partChoices } from "./picker";

/**
 * The best-practice card and the way to one (spec F-S5 v2, decision 0083).
 *
 * The card was built with the Ask box and had no door: nothing mounted it and nothing called
 * `bestPracticeAction`, so the half of F-S5 v2 that answers "what does good look like for this part" could not
 * be reached. The picker is that door, and it sits under the Ask box because both read the same rulebook and
 * are scoped to the same design.
 *
 * It is a form with one submit button per part, so it works the way every other action in this app does: the
 * server decides, the schema refuses a part it does not know, and a failure comes back as a sentence. Nothing
 * is guessed here and no rule's words are written in this file.
 */
export function BestPractice({ articleCode, method }: Readonly<{ articleCode?: string; method?: string }>) {
  const { form, submit, pending, summary, state } = useFormAction<Card>(bestPracticeAction);
  const card = state.result?.success ? state.result.data : null;
  const ids = bestPracticePickerProps(pending);

  return (
    <section className="flex flex-col gap-3" aria-labelledby={ids.headingId}>
      <h2 id={ids.headingId} className="font-semibold text-ink">
        What good looks like
      </h2>
      <p className="text-sm text-muted">
        Choose a part. Knitwright shows the rulebook&#x27;s own best practice for it, and names the rule behind every line.
      </p>
      <form ref={form} action={submit} noValidate className="flex flex-col gap-3" data-testid="best-practice-form">
        <FormSummary message={summary} />
        <input type="hidden" name="articleCode" value={articleCode ?? ""} />
        <input type="hidden" name="method" value={method ?? ""} />
        <div {...ids.groupProps} className="flex flex-wrap gap-2">
          {partChoices(card).map((choice) => (
            <Button
              key={choice.key}
              type="submit"
              name="part"
              value={choice.key}
              variant="secondary"
              disabled={pending}
              className={choice.chosen ? "border-white/45 text-white" : ""}
            >
              {choice.label}
            </Button>
          ))}
        </div>
      </form>
      <div {...ids.cardProps}>{card ? <BestPracticeCard card={card} /> : null}</div>
    </section>
  );
}
