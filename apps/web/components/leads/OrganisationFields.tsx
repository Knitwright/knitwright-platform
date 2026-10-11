"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { AU_STATES, ORGANISATION_TYPES, REGION_MAX, countryOptions } from "@/lib/leads/organisation";

type Values = Readonly<{ organisationType: string; country: string; region: string }>;

type Props = Readonly<{
  values: Values;
  errors: (name: string) => readonly string[];
}>;

const COUNTRIES = countryOptions();

/**
 * The organisation type, country and state or region. Australia asks for a state from a list;
 * every other country takes a region in the person's own words. All three are optional.
 */
export function OrganisationFields({ values, errors }: Props) {
  const [country, setCountry] = useState(values.country);
  return (
    <>
      <SelectField
        name="organisationType"
        label="Type of organisation"
        hint="Optional."
        options={ORGANISATION_TYPES}
        placeholder="Choose a type"
        defaultValue={values.organisationType}
        errors={errors("organisationType")}
      />
      <SelectField
        name="country"
        label="Country"
        hint="Optional."
        options={COUNTRIES}
        placeholder="Choose a country"
        value={country}
        onChange={(event) => setCountry(event.target.value)}
        autoComplete="country"
        errors={errors("country")}
      />
      {country === "AU" ? (
        <SelectField
          key="state"
          name="region"
          label="State or territory"
          hint="Optional."
          options={AU_STATES}
          placeholder="Choose a state or territory"
          defaultValue={AU_STATES.some((state) => state.id === values.region) ? values.region : ""}
          errors={errors("region")}
        />
      ) : (
        <Field
          key="region"
          name="region"
          label="State or region"
          hint={country ? "Optional." : "Optional. Choose a country first."}
          type="text"
          maxLength={REGION_MAX}
          disabled={!country}
          defaultValue={values.region}
          autoComplete="address-level1"
          errors={errors("region")}
        />
      )}
    </>
  );
}
