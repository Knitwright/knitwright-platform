"use client";

import { useState } from "react";
import { BotCheck, useBotCheck } from "@/components/auth/BotCheck";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useSendForm } from "@/components/forms/useSendForm";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { CAPTCHA_FIELD } from "@/lib/auth/fields";
import { rosterSignupAction } from "@/lib/clubs/signup/actions";
import { ANSWER_KEPT, NAME_HINT, NAME_LABEL, NUMBER_LABEL, SIZE_LABEL, WEARER_LABEL } from "@/lib/clubs/signup/fields";
import type { SignupPageData } from "@/lib/clubs/signup/public-load";
import type { WearerGroup } from "@/lib/clubs/wording";
import { SizeGuideTable } from "./SizeGuideTable";

type SignupFormProps = Readonly<{ token: string; page: SignupPageData; siteKey: string }>;

/**
 * A player's shirt name, number and size (spec F-T4 step 2). Every control is labelled, has a real
 * input type and, where a browser can fill it in, an autocomplete hint. The size guide for the cut
 * they choose is on the page beside the field, which is what F-T4 asks for.
 */
export function SignupForm({ token, page, siteKey }: SignupFormProps) {
  const { form, state, onSubmit, pending, sent, summary, fieldErrors } = useSendForm(rosterSignupAction);
  const { guard, widget } = useBotCheck(state.attempt);
  const [cut, setCut] = useState<WearerGroup>(page.cuts[0]?.group ?? "unisex");
  const chosen = page.cuts.find((entry) => entry.group === cut) ?? page.cuts[0];

  if (sent) {
    return (
      <FormDone>
        <strong className="font-semibold">Done.</strong> {ANSWER_KEPT}
      </FormDone>
    );
  }

  return (
    <form
      ref={form}
      onSubmit={(event) => {
        guard(event);
        void onSubmit(event);
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      <FormSummary message={summary} />
      <input type="hidden" name="token" value={token} />

      <Field
        name="name"
        label={NAME_LABEL}
        hint={`${NAME_HINT} Up to ${page.nameMaxCharacters} characters.`}
        autoComplete="family-name"
        autoCapitalize="characters"
        maxLength={page.nameMaxCharacters}
        required
        defaultValue={state.values.name}
        errors={fieldErrors("name")}
      />

      <Field
        name="number"
        label={NUMBER_LABEL}
        hint={page.numberHint}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={3}
        required
        defaultValue={state.values.number}
        errors={fieldErrors("number")}
      />

      <SelectField
        name="wearerGroup"
        label={WEARER_LABEL}
        hint="The size guide below changes with this."
        options={page.cuts.map((entry) => ({ id: entry.group, label: entry.label }))}
        value={cut}
        onChange={(event) => setCut(event.currentTarget.value as WearerGroup)}
        required
        errors={fieldErrors("wearerGroup")}
      />

      {page.sizesNotice ? (
        <p className="text-sm text-warn" role="status">
          {page.sizesNotice}
        </p>
      ) : (
        <SelectField
          name="sizeLabel"
          label={SIZE_LABEL}
          options={page.sizes.map((size) => ({ id: size, label: size }))}
          placeholder="Choose a size"
          required
          defaultValue={state.values.sizeLabel}
          errors={fieldErrors("sizeLabel")}
        />
      )}

      {chosen ? (
        <details className="rounded-xl border border-hairline" data-testid="signup-size-guide">
          <summary className="flex min-h-10 cursor-pointer items-center px-3 text-[15px] text-ink">
            Size guide · {chosen.label}
          </summary>
          <div className="border-t border-hairline p-3">
            <SizeGuideTable guide={chosen.guide} label={chosen.label} />
          </div>
        </details>
      ) : null}

      <BotCheck siteKey={siteKey} widget={widget} errors={fieldErrors(CAPTCHA_FIELD)} />
      <Button type="submit" pending={pending}>
        {pending ? "Sending" : "Send my details"}
      </Button>
    </form>
  );
}
