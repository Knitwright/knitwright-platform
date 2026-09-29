"use client";

import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import {
  STRETCH_CHOICES,
  fabricAction,
  type FabricFormRow,
  type FabricValues,
  type PanelFabricRow,
} from "@/lib/projects/tech-pack-forms";
import { RowForm, type FormFieldSpec } from "./RowForm";
import { useTechPackEdit } from "./TechPackEdit";

const fieldsFor = (values: FabricValues): readonly FormFieldSpec[] => [
  { name: "name", label: "Fabric name", value: values.name },
  {
    name: "composition",
    label: "Composition",
    value: values.composition,
    hint: "What the fabric is made of, for example cotton and elastane.",
  },
  {
    name: "construction",
    label: "Construction",
    value: values.construction,
    hint: "How the fabric is knitted, for example interlock.",
  },
  { name: "weight", label: "Weight (grams per square metre)", value: values.weight },
  { name: "finish", label: "Finish", value: values.finish },
  {
    name: "consumption",
    label: "Fabric used for one garment",
    value: values.consumption,
    hint: "Write the amount with its unit. Leave it empty until you know it.",
  },
  { name: "stretch", label: "Stretch", value: values.stretch, choices: STRETCH_CHOICES },
];

const valuesFrom = (typed: Readonly<Record<string, string>>): FabricValues => ({
  name: typed.name ?? "",
  composition: typed.composition ?? "",
  construction: typed.construction ?? "",
  weight: typed.weight ?? "",
  finish: typed.finish ?? "",
  consumption: typed.consumption ?? "",
  stretch: typed.stretch ?? "not-set",
});

function FabricRow({ row }: Readonly<{ row: FabricFormRow }>) {
  const edit = useTechPackEdit();
  const remove = (
    <Button
      type="button"
      variant="quiet"
      disabled={!row.canRemove}
      onClick={() => edit.save(`fabric:${row.id}`, { type: "remove-fabric", id: row.id })}
    >
      {`Remove ${row.values.name}`}
    </Button>
  );
  return (
    <li className="rounded-xl border border-hairline p-4">
      <h4 className="text-sm font-semibold text-ink">{row.values.name}</h4>
      <p className="mb-3 text-sm text-muted">
        {row.usedBy.length > 0 ? `Used for: ${row.usedBy.join(", ")}.` : "No panel uses this fabric yet."}
      </p>
      <RowForm
        formKey={`fabric:${row.id}`}
        title={`Fabric ${row.values.name}`}
        fields={fieldsFor(row.values)}
        submitLabel={`Save ${row.values.name}`}
        build={(typed) => fabricAction(row.id, valuesFrom(typed), false)}
        extra={remove}
      />
    </li>
  );
}

const NEW_FABRIC: FabricValues = {
  name: "",
  composition: "",
  construction: "",
  weight: "",
  finish: "",
  consumption: "",
  stretch: "not-set",
};

function AddFabric() {
  return (
    <div className="rounded-xl border border-dashed border-hairline p-4">
      <h4 className="mb-3 text-sm font-semibold text-ink">Add another fabric</h4>
      <RowForm
        formKey="fabric:new"
        title="Add a fabric"
        fields={fieldsFor(NEW_FABRIC)}
        submitLabel="Add fabric"
        // Each fabric added gets an id of its own, chosen when the form is sent.
        build={(typed) => fabricAction(crypto.randomUUID(), valuesFrom(typed), true)}
        clearAfterSave
      />
    </div>
  );
}

function PanelFabric({ row }: Readonly<{ row: PanelFabricRow }>) {
  const edit = useTechPackEdit();
  return (
    <li>
      <SelectField
        name={row.panelId}
        label={`Fabric for ${row.label}`}
        options={row.choices}
        defaultValue={row.fabricId}
        onChange={(event) =>
          edit.save(`panel-fabric:${row.panelId}`, {
            type: "assign-fabric",
            panelId: row.panelId,
            fabricId: event.target.value,
          })
        }
      />
    </li>
  );
}

type FabricFormsProps = Readonly<{ fabrics: readonly FabricFormRow[]; panels: readonly PanelFabricRow[] }>;

/** Describe each fabric, add more, and say which fabric each panel uses. Markup and wiring only. */
export function FabricForms({ fabrics, panels }: FabricFormsProps) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-ink">Fabrics</h3>
      <ul className="flex flex-col gap-4">
        {fabrics.map((row) => (
          <FabricRow key={row.id} row={row} />
        ))}
      </ul>
      <AddFabric />
      <h3 className="text-sm font-semibold text-ink">Which fabric each panel uses</h3>
      <ul className="grid gap-3 sm:grid-cols-2">
        {panels.map((row) => (
          <PanelFabric key={`${row.panelId}-${row.fabricId}`} row={row} />
        ))}
      </ul>
    </div>
  );
}
