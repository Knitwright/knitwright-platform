"use client";

import { explainRuleAction } from "@/lib/rulebook/actions";
import { WhyPopover } from "./WhyPopover";

/**
 * `<WhyLink ruleId="R-SUB-004" />`: the "Why?" link every finding, range, option and tech-pack field carries
 * (spec F-S5, decision 0067). An id with no rulebook entry shows the gap text and is logged for the team.
 * `context` says where the link was opened (a check code or a field), for the gap list.
 */
export function WhyLink({ ruleId, context, label }: Readonly<{ ruleId: string; context?: string; label?: string }>) {
  return <WhyPopover ruleId={ruleId} context={context} label={label} explain={explainRuleAction} />;
}
