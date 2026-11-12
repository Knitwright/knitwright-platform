"use client";

import { useState } from "react";
import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Inputs";
import type { FormAction } from "@/lib/forms/form-state";
import { retentionLine } from "@/lib/team/view";

type RetentionFormProps = Readonly<{ action: FormAction<{ keep: boolean }>; keep: boolean; canChange: boolean }>;

/**
 * "Keep rosters after two seasons" (decision 0144 over D5's opt-in). Off is the default and the
 * privacy rule: old rosters are purged. Only an owner or an admin can turn it on.
 */
export function RetentionForm({ action, keep, canChange }: RetentionFormProps) {
  const { form, state, submit, pending, summary } = useFormAction(action);
  const saved = state.result?.success ? state.result.data.keep : null;
  const [on, setOn] = useState(keep);
  const shown = saved ?? keep;

  return (
    <form ref={form} action={submit} className="flex flex-col gap-3" noValidate data-testid="roster-retention">
      <FormSummary message={summary} />
      {saved !== null ? <FormDone>{retentionLine(saved)}</FormDone> : <p className="text-body text-text-2">{retentionLine(shown)}</p>}
      <input type="hidden" name="keep" value={on ? "on" : "off"} />
      <Toggle checked={on} onChange={setOn} label="Keep rosters after two seasons" disabled={!canChange} />
      {canChange ? (
        <div>
          <Button type="submit" variant="secondary" pending={pending} disabled={on === shown}>
            {pending ? "Saving" : "Save roster setting"}
          </Button>
        </div>
      ) : (
        <p className="text-small text-muted">Only an owner or an admin can change this.</p>
      )}
    </form>
  );
}
