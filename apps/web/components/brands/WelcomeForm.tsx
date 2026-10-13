"use client";

import { useState } from "react";
import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { OrganisationFields } from "@/components/leads/OrganisationFields";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { createBrandAction } from "@/lib/brands/actions";
import { BRAND_NAME_MAX } from "@/lib/brands/limits";
import { welcomeWording } from "@/lib/brands/welcome";
import { ORGANISATION_TYPES } from "@/lib/leads/organisation";

/**
 * The first form a new person fills in. It asks who they design for first, then words the name
 * and the button for that answer. The type, country and region stay optional (decision 0024).
 */
export function WelcomeForm() {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(createBrandAction);
  const [type, setType] = useState(state.values.organisationType ?? "");
  const words = welcomeWording(type);
  const typeErrors = fieldErrors("organisationType");

  return (
    <form ref={form} action={submit} className="flex flex-col gap-5" noValidate>
      <FormSummary message={summary} />
      <fieldset aria-describedby={typeErrors.length > 0 ? "welcome-type-error" : undefined}>
        <legend className="text-base font-semibold text-ink">Who are you designing for?</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {ORGANISATION_TYPES.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-hairline px-3 py-2.5 text-[15px] text-ink has-[:checked]:border-cobalt has-[:checked]:bg-shell"
            >
              <input
                type="radio"
                name="organisationType"
                value={option.id}
                checked={type === option.id}
                onChange={() => setType(option.id)}
              />
              {option.label}
            </label>
          ))}
        </div>
        {typeErrors.length > 0 ? (
          <p id="welcome-type-error" className="mt-2 text-sm text-warn">
            {typeErrors.join(" ")}
          </p>
        ) : null}
      </fieldset>
      <Field
        name="name"
        label={words.nameLabel}
        hint={words.nameHint}
        type="text"
        autoComplete="organization"
        required
        maxLength={BRAND_NAME_MAX}
        defaultValue={state.values.name}
        errors={fieldErrors("name")}
      />
      <OrganisationFields
        withType={false}
        values={{ organisationType: type, country: state.values.country ?? "", region: state.values.region ?? "" }}
        errors={fieldErrors}
      />
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Setting up" : words.submit}
        </Button>
      </div>
    </form>
  );
}
