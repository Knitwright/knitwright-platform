"use client";

import { useId } from "react";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { TEXT_AREA } from "@/components/ui/field-styles";
import { saveRuleAction } from "@/lib/rulebook/actions";
import { SOURCES, TOPICS, type RulebookEntry } from "@/lib/rulebook/constants";
import { SOURCE_LABELS } from "@/lib/rulebook/view";

const TOPIC_OPTIONS = TOPICS.map((id) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) }));
const SOURCE_OPTIONS = SOURCES.map((id) => ({ id, label: SOURCE_LABELS[id] }));

type Errors = (name: string) => readonly string[];

function Area({ name, label, defaultValue, errors }: Readonly<{ name: string; label: string; defaultValue: string; errors: Errors }>) {
  const id = useId();
  const shown = errors(name);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <textarea id={id} name={name} rows={3} defaultValue={defaultValue} aria-invalid={shown.length > 0 || undefined} className={TEXT_AREA} />
      {shown.length > 0 ? <p className="text-sm text-warn">{shown.join(" ")}</p> : null}
    </div>
  );
}

/**
 * Saves a new version of a rule, or version 1 of a new rule when `entry` is left out. The earlier version stays as
 * it was; the new one starts as a draft until the factory confirms it. Owner decision 12: a rule names the articles
 * or the ways of making a garment it covers, and at least one of the two, so it can never claim every article.
 */
export function RuleEditor({ entry }: Readonly<{ entry?: RulebookEntry }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(saveRuleAction);
  const done = state.result?.success === true ? state.result.data : null;
  return (
    <form ref={form} action={submit} noValidate className="flex flex-col gap-3" data-testid={`rule-editor-${entry?.ruleId ?? "new"}`}>
      <FormSummary message={summary} />
      {done ? <FormDone>Saved as version {done.version} of {done.ruleId}, a draft.</FormDone> : null}
      {entry ? <input type="hidden" name="ruleId" value={entry.ruleId} /> : (
        <Field name="ruleId" label="Rule id" hint="For example R-SUB-009. An id is never reused." errors={fieldErrors("ruleId")} />
      )}
      <SelectField name="topic" label="Topic" options={TOPIC_OPTIONS} defaultValue={entry?.topic ?? ""} placeholder="Choose a topic" errors={fieldErrors("topic")} />
      <Field name="articleCodes" label="Article codes" hint="The articles this rule covers. Leave empty when it covers a way of making a garment instead." defaultValue={entry?.articleCodes.join(", ") ?? ""} errors={fieldErrors("articleCodes")} />
      <Field name="methods" label="Methods" hint="The ways of making a garment this rule covers, for example sublimation." defaultValue={entry?.methods.join(", ") ?? ""} errors={fieldErrors("methods")} />
      <Field name="scopeNote" label="Scope note" hint="How far the scope has been checked, in plain words." defaultValue={entry?.scopeNote ?? ""} errors={fieldErrors("scopeNote")} />
      <Field name="title" label="Applies to" defaultValue={entry?.title ?? ""} errors={fieldErrors("title")} />
      <Area name="rule" label="Rule" defaultValue={entry?.rule ?? ""} errors={fieldErrors} />
      <Area name="body" label="Why" defaultValue={entry?.body ?? ""} errors={fieldErrors} />
      <Area name="bestPractice" label="Best practice" defaultValue={entry?.bestPractice ?? ""} errors={fieldErrors} />
      <SelectField name="source" label="Source" options={SOURCE_OPTIONS} defaultValue={entry?.source ?? ""} placeholder="Choose a source" errors={fieldErrors("source")} />
      <Field name="sourceNote" label="Source note" hint="Who said so, in their words." defaultValue={entry?.sourceNote ?? ""} errors={fieldErrors("sourceNote")} />
      <div>
        <Button type="submit" pending={pending}>{pending ? "Saving" : entry ? "Save as a new version" : "Add the rule"}</Button>
      </div>
    </form>
  );
}
