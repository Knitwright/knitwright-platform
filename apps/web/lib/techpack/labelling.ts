import { LABELLING_FIELDS, LABELLING_LABELS, type GarmentSpec } from "@/lib/garment";
import { TBC } from "./cell";
import { SOME_MISSING } from "./text";
import type { LabellingSection } from "./types";
import { SECTION_TITLES } from "./types";

/** Care, composition, origin, fold and bag. All are written by the user, and to be confirmed until then. */
export function buildLabelling(spec: GarmentSpec): LabellingSection {
  const rows = LABELLING_FIELDS.map((field) => {
    const entry = spec.labelling[field];
    return {
      field,
      label: LABELLING_LABELS[field],
      value: entry ? ({ status: "set", value: entry.text, provenance: entry.provenance } as const) : TBC,
    };
  });
  const missing = rows.some((row) => row.value.status !== "set");
  return {
    id: "labelling",
    title: SECTION_TITLES.labelling,
    note: missing ? SOME_MISSING : null,
    rows,
  };
}
