import type { Finding } from "@/lib/production/contract";
import type { GarmentSpec } from "@/lib/garment";
import { buildPackFor, type PackInput } from "@/lib/projects/tech-pack-data";
import { validateDesign } from "@/lib/validation/validate";
import type { FactoryProfile } from "@/lib/validation/profile";
import type { VariantFinding, VariantGate } from "./types";

const fromContract = (finding: Finding): VariantFinding => ({ code: finding.code, severity: finding.severity, panel: finding.panel, message: finding.message });

/**
 * The validation gate (decision 0039) run on a candidate design: the tech pack's readiness for that design,
 * checked against the factory profile. The design's own reads (history, charts, names, production) are reused;
 * only the spec is the candidate's. The flats are not drawn, since readiness does not need them.
 */
export function validationGate(base: PackInput, profile: FactoryProfile): VariantGate {
  return (spec: GarmentSpec) => {
    const pack = buildPackFor({ ...base, project: { ...base.project, spec } }, { drawFlats: false });
    return validateDesign({ typeId: spec.typeId, readiness: pack.readiness }, profile).findings.map(fromContract);
  };
}
