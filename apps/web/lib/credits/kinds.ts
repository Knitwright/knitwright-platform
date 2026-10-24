/**
 * What credits are spent on. Plan v4, workstream V6.
 *
 * Designing, saving versions, 3D views, the team store hand-off and the tech pack summary are
 * free, so they are not listed here. These three cost credits once the exports are gated
 * (wave 2; nothing is gated yet).
 */
export const OUTPUT_KINDS = ["marketing_media", "techpack_pdf", "pattern_file"] as const;

export type OutputKind = (typeof OUTPUT_KINDS)[number];

export const OUTPUT_LABELS: Readonly<Record<OutputKind, string>> = {
  marketing_media: "Marketing media",
  techpack_pdf: "Full tech pack PDF",
  pattern_file: "Pattern file",
};

export const isOutputKind = (value: string): value is OutputKind =>
  (OUTPUT_KINDS as readonly string[]).includes(value);

export const ENTRY_KINDS = ["grant", "spend", "refund", "expire"] as const;

export type EntryKind = (typeof ENTRY_KINDS)[number];
