"use client";

import { useState } from "react";
import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { confirmRulesAction } from "@/lib/rulebook/actions";
import { choiceOf, signOffDone, signOffLabel, signOffLead, type SignOffPlan, type SignOffRule } from "@/lib/rulebook/sign-off";

/**
 * One sign-off session (owner question F3; decision 0129). A person's name and role are typed once and every rule
 * they reviewed is confirmed in one press, instead of the same two names typed into one form per rule.
 *
 * The rules Knitwright owns are offered ticked; the ones whose Source column still defers to a factory, a
 * supplier or a lawyer are offered unticked, with that note shown, because a Knitwright name against those words
 * would credit a review nobody did. Unticking and ticking are both the person's to do: the defaults carry the
 * rulebook's own reading, not a rule about who may confirm what.
 */
export function SignOff({ plan }: Readonly<{ plan: SignOffPlan }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(confirmRulesAction);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set(plan.owned.map(choiceOf)));
  const confirmed = state.result?.success === true ? state.result.data.confirmed : null;

  const toggle = (choice: string) =>
    setTicked((held) => {
      const next = new Set(held);
      if (!next.delete(choice)) next.add(choice);
      return next;
    });

  const row = (rule: SignOffRule) => (
    <li key={rule.ruleId}>
      <CheckboxField
        name="rules"
        value={choiceOf(rule)}
        checked={ticked.has(choiceOf(rule))}
        onChange={() => toggle(choiceOf(rule))}
        label={`${rule.ruleId} · ${rule.title}`}
        hint={rule.waitsFor ? `Waits for ${rule.waitsFor}: ${rule.sourceNote}` : rule.sourceNote}
        data-testid={`sign-off-${rule.ruleId}`}
      />
    </li>
  );

  return (
    <form ref={form} action={submit} noValidate className="glass flex flex-col gap-4 rounded-[1.75rem] p-6" data-testid="sign-off">
      <FormSummary message={summary} />
      {confirmed === null ? null : (
        <div data-testid="sign-off-done">
          <Notice tone="ok">{signOffDone(confirmed)}</Notice>
        </div>
      )}
      <p className="text-[15px] leading-relaxed text-ink-2">{signOffLead(plan)}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          name="confirmedName"
          label="Reviewed by"
          hint="The person who read these versions, in their own name."
          errors={fieldErrors("confirmedName")}
        />
        <Field name="confirmedRole" label="Their role" hint="For example pattern master." errors={fieldErrors("confirmedRole")} />
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-ink">Knitwright&rsquo;s own words and the published standards</legend>
        <ul className="flex flex-col gap-3">{plan.owned.map(row)}</ul>
        {fieldErrors("rules").length > 0 ? <p className="text-sm text-warn">{fieldErrors("rules").join(" ")}</p> : null}
      </fieldset>
      {plan.waiting.length === 0 ? null : (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink">Waiting for somebody outside Knitwright ({plan.waiting.length})</summary>
          <ul className="mt-3 flex flex-col gap-3">{plan.waiting.map(row)}</ul>
        </details>
      )}
      <div>
        <Button type="submit" pending={pending} disabled={ticked.size === 0}>
          {pending ? "Confirming" : signOffLabel(ticked.size)}
        </Button>
      </div>
    </form>
  );
}
