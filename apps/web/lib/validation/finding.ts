import type { Finding } from "@/lib/production/contract";

interface FindingInput {
  readonly code: string;
  readonly severity: Finding["severity"];
  readonly message: string;
  readonly action: string;
  readonly whoActs: Finding["fix"]["whoActs"];
  readonly article?: string | null;
  readonly panel?: string | null;
}

export const finding = (input: FindingInput): Finding => ({
  code: input.code,
  severity: input.severity,
  article: input.article ?? null,
  panel: input.panel ?? null,
  message: input.message,
  fix: { action: input.action, whoActs: input.whoActs },
});
