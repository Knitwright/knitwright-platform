import { finding } from "../finding";
import type { ModerationStatus } from "../ports";
import type { CheckModule, DesignInput, RuledFinding } from "../registry";
import { ruleIdFor } from "../rules";

/**
 * THE ONE SETTING (H3 of the v5 security review, decision 0116; its owner question 1, answered as
 * owner question E113 on 2026-11-03: an unscreened picture **warns**, decision 0128).
 *
 * **False: an unscreened picture or text warns, and "Ready for the factory" still opens.** Almost
 * nothing in the platform has ever been screened -- only `POST /api/artwork` screens on the way in
 * -- so a blocker here would mean every brand re-adding its existing artwork through that one path
 * before it could hand anything to a factory. The warning names the picture and says what to do, so
 * the fact is in front of the person rather than in the way of their first order.
 *
 * Until the review, `lib/validation/live-ports.ts` dropped a target with no stored screening from
 * the answer, so this module raised nothing and F-G2's "moderation status clear" held for content
 * nobody had ever looked at. The port says `pending` now, and this decides what `pending` costs.
 *
 * **Set it to true and an unscreened target holds the hand-off shut instead.** That is the whole of
 * the strict policy: one line here, no rewrite anywhere, and `modules.test.ts` holds both answers.
 * Nothing else about the check changes -- a flagged or blocked target blocks either way, which is
 * what makes this safe to soften: it softens "nobody has looked", never "somebody said no".
 */
export const UNSCREENED_BLOCKS_HANDOFF = false;

const MESSAGES: Readonly<Record<Exclude<ModerationStatus["result"], "clear">, { severity: "blocker" | "warning"; message: string; action: string }>> = {
  pending: {
    severity: UNSCREENED_BLOCKS_HANDOFF ? "blocker" : "warning",
    message: "has not been through the content review, so nobody has looked at it yet.",
    action: "Upload it again to send it for review, or replace it. Nothing else is needed from you.",
  },
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

/**
 * F-G2 "moderation status clear": each asset and text the design uses, read through `ModerationReader`.
 *
 * Each finding names the thing that is unscreened, by the label the design gives it, so the list
 * says which picture to look at rather than that something is wrong somewhere.
 */
export const moderationClear: CheckModule = {
  id: "moderation-clear",
  run: (design) => (design.moderation ?? []).flatMap((status) => toFinding(design, status) ?? []),
};
