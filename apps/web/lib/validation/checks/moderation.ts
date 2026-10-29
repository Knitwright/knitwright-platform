import { finding } from "../finding";
import type { ModerationStatus } from "../ports";
import type { CheckModule, DesignInput, RuledFinding } from "../registry";
import { ruleIdFor } from "../rules";

const MESSAGES: Readonly<Record<Exclude<ModerationStatus["result"], "clear">, { severity: "blocker" | "warning"; message: string; action: string }>> = {
  pending: { severity: "warning", message: "is waiting for the content review.", action: "Wait for the review. Nothing else is needed from you." },
  flagged: { severity: "blocker", message: "was flagged by the content review and waits for a person at Knitwright.", action: "Wait for the review, or replace it." },
  blocked: { severity: "blocker", message: "was blocked by the content review and cannot be printed.", action: "Replace it with artwork you have the rights to." },
};

const toFinding = (design: DesignInput, status: ModerationStatus): RuledFinding | null => {
  if (status.result === "clear") return null;
  const said = MESSAGES[status.result];
  const code = `moderation-${status.result}`;
  return {
    ...finding({ code, severity: said.severity, article: design.typeId, message: `${status.target.label} ${said.message}`, action: said.action, whoActs: "owner" }),
    ruleId: ruleIdFor(code),
  };
};

/** F-G2 "moderation status clear": each asset and text the design uses, read through `ModerationReader`. */
export const moderationClear: CheckModule = {
  id: "moderation-clear",
  run: (design) => (design.moderation ?? []).flatMap((status) => toFinding(design, status) ?? []),
};
