/**
 * What credits are spent on. Plan v4, workstream V6.
 *
 * Designing, saving versions, 3D views, the team store hand-off and the tech pack summary are
 * free, so they are not listed here. These four cost credits where the exports are gated.
 *
 * `production_package` is the factory ZIP of docs/spec/04-production-package.md (plan v5 X5b,
 * decision 0070). It is free when Knitwright makes the order and free for a production batch, and
 * charged when a brand takes the files to a factory Knitwright does not own, per owner decision 20
 * of plan v5 — which is money, so the owner may overturn it. `lib/kpp/export.ts` decides which.
 */
export const OUTPUT_KINDS = ["marketing_media", "techpack_pdf", "pattern_file", "production_package"] as const;

export type OutputKind = (typeof OUTPUT_KINDS)[number];

export const OUTPUT_LABELS: Readonly<Record<OutputKind, string>> = {
  marketing_media: "Marketing media",
  techpack_pdf: "Full tech pack PDF",
  pattern_file: "Pattern file",
  production_package: "Production package",
};

export const ENTRY_KINDS = ["grant", "spend", "refund", "expire"] as const;

export type EntryKind = (typeof ENTRY_KINDS)[number];
