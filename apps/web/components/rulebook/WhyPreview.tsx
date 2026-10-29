"use client";

import { useId, useState } from "react";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { WhyLink } from "./WhyLink";

/**
 * Type any rule id and open its "Why?" as a member would see it. An id of the form R-SUB-004 with no entry shows
 * the gap text and is added to the gap list, which is how the team can try the gap path on purpose.
 */
export function WhyPreview() {
  const id = useId();
  const [ruleId, setRuleId] = useState("");
  const typed = ruleId.trim().toUpperCase();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-ink">Rule id to try</label>
        <input id={id} value={ruleId} onChange={(event) => setRuleId(event.target.value)} className={FIELD_CONTROL} placeholder="R-SUB-004" />
      </div>
      {typed ? <WhyLink key={typed} ruleId={typed} context="admin preview" /> : null}
    </div>
  );
}
