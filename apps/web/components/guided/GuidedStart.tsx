"use client";

import { Fragment, useState, type ReactNode } from "react";
import { BuyerKindChoice } from "@/components/leads/BuyerKindChoice";
import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import type { StartMethod } from "@/lib/guided/flow";
import { MAX_UTTERANCE_LENGTH } from "@/lib/intent/text-flow";
import { startGuidedAction } from "@/lib/projects/actions";
import type { TypeGroup } from "@/lib/projects/type-groups";

type Choice = Readonly<{ id: string; label: string }>;
type Props = Readonly<{
  types: readonly TypeGroup[];
  wearers: readonly Choice[];
  /** The path ticked at first, from the brand's type of organisation. Empty for none. */
  initialKind?: string;
}>;
type Fields = Readonly<{ kept: (name: string) => string; errors: (name: string) => readonly string[] }>;

/**
 * The first page of the guided flow: three ways to start, each one form. Whatever is chosen,
 * the design is made at once and the guide opens. Rules live in lib/guided.
 */
export function GuidedStart({ types, wearers, initialKind = "" }: Props) {
  // The path is asked first (decision 0024) and sent with whichever way to start is chosen.
  const [buyerKind, setBuyerKind] = useState(initialKind);
  return (
    <div className="grid gap-6">
      <BuyerKindChoice value={buyerKind} onChange={setBuyerKind} />
      <StartForm
        buyerKind={buyerKind}
        method="text"
        title="Describe it in your own words"
        lead="For example: a slim polo shirt for women with long sleeves."
        submit="Start from these words"
      >
        {({ kept, errors }) => <SentenceField kept={kept} errors={errors} />}
      </StartForm>
      <StartForm
        buyerKind={buyerKind}
        method="sketch"
        title="Start from a sketch or photo"
        lead="You will be asked for the picture next. Nothing changes until you check what was read."
        submit="Start from a picture"
      />
      <StartForm
        buyerKind={buyerKind}
        method="picker"
        title="Pick a garment"
        lead="Choose the garment and who it is for. You can change every option afterwards."
        submit="Start from this garment"
      >
        {({ kept, errors }) => (
          <>
            <SelectField name="typeId" label="Garment type" options={types} placeholder="Choose a garment type" required defaultValue={kept("typeId")} errors={errors("typeId")} />
            <SelectField name="wearer" label="Made for" options={wearers} placeholder="Choose who it is for" required defaultValue={kept("wearer")} errors={errors("wearer")} />
          </>
        )}
      </StartForm>
    </div>
  );
}

type StartFormProps = Readonly<{
  buyerKind: string;
  method: StartMethod;
  title: string;
  lead: string;
  submit: string;
  children?: (fields: Fields) => ReactNode;
}>;

function StartForm({ buyerKind, method, title, lead, submit, children }: StartFormProps) {
  const { form, state, submit: send, pending, summary, fieldErrors } = useFormAction(startGuidedAction);
  const headingId = `start-${method}`;
  return (
    <section aria-labelledby={headingId} className="rounded-2xl border border-hairline bg-surface p-6">
      <h2 id={headingId} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{lead}</p>
      <form ref={form} action={send} className="mt-4 flex flex-col gap-4" noValidate>
        <FormSummary message={summary} />
        <input type="hidden" name="method" value={method} />
        <input type="hidden" name="buyerKind" value={buyerKind} />
        {fieldErrors("buyerKind").length > 0 ? <p className="text-sm text-warn">{fieldErrors("buyerKind").join(" ")}</p> : null}
        {/* Drawn again after each attempt, so a refused form shows what was chosen, not the empty first choice. */}
        <Fragment key={state.attempt}>{children?.({ kept: (name) => state.values[name] ?? "", errors: fieldErrors })}</Fragment>
        <div>
          <Button type="submit" pending={pending}>
            {pending ? "Starting" : submit}
          </Button>
        </div>
      </form>
    </section>
  );
}

function SentenceField({ kept, errors }: Fields) {
  const problems = errors("sentence");
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="guided-sentence" className="text-sm font-medium text-ink">
        What do you want to make?
      </label>
      <textarea
        id="guided-sentence"
        name="sentence"
        rows={3}
        maxLength={MAX_UTTERANCE_LENGTH}
        defaultValue={kept("sentence")}
        aria-invalid={problems.length > 0 ? true : undefined}
        aria-describedby={problems.length > 0 ? "guided-sentence-error" : undefined}
        className="rounded-lg border border-hairline bg-surface px-3 py-2 text-[15px] text-ink"
      />
      {problems.length > 0 ? (
        <p id="guided-sentence-error" className="text-sm text-warn">
          {problems.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
