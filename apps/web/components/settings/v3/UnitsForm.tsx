"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Radio } from "@/components/ui/Inputs";
import type { FormAction } from "@/lib/forms/form-state";
import { GARMENT_UNITS, GARMENT_UNIT_LABELS, type GarmentUnit } from "@/lib/units/preference";

type UnitsFormProps = Readonly<{ action: FormAction<{ unit: GarmentUnit }>; unit: GarmentUnit }>;

/**
 * Settings' Units (09 screen 19, decision 0144): the unit garment lengths are read in. Millimetres is
 * the default, as factories write. Social sizes are always pixels, so they have no choice here.
 */
export function UnitsForm({ action, unit }: UnitsFormProps) {
  const { form, state, submit, pending, summary } = useFormAction(action);
  const saved = state.result?.success ? state.result.data.unit : null;
  const chosen = saved ?? unit;

  return (
    <form ref={form} action={submit} className="flex flex-col gap-4" noValidate>
      <FormSummary message={summary} />
      {saved ? <FormDone>Garment lengths now read in {GARMENT_UNIT_LABELS[saved].toLowerCase()}.</FormDone> : null}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-body font-semibold text-text">Garment lengths</legend>
        {GARMENT_UNITS.map((id) => (
          <Radio key={`${id}-${chosen}`} name="unit" value={id} defaultChecked={id === chosen} label={GARMENT_UNIT_LABELS[id]} />
        ))}
      </fieldset>
      <p className="text-small text-muted">Size charts, measurements and the tech pack open in this unit. What is stored never changes.</p>
      <div>
        <Button type="submit" pending={pending}>
          {pending ? "Saving" : "Save units"}
        </Button>
      </div>
    </form>
  );
}
