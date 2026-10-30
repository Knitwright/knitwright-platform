"use client";

import { useState } from "react";
import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { inviteToShareAction } from "@/lib/share/actions";
import { DEFAULT_LINK_DAYS, LINK_DAYS } from "@/lib/share/fields";
import { ACCESS_LABELS, ACCESS_NOTES, MESSAGE_MAX, SHARE_ACCESS } from "@/lib/share/invite-fields";

/**
 * Invite by email, with Can view / Can comment / Can edit and a message (spec F-S4 Share).
 *
 * The invite's own link is shown once, exactly as a share link is: only its hash is kept, so it
 * cannot be shown again. Whether an email went out is said plainly either way — without an email
 * provider nothing is sent and the member sends the link themselves.
 */

const ACCESS_OPTIONS = SHARE_ACCESS.map((id) => ({ id, label: ACCESS_LABELS[id] }));
const DAY_OPTIONS = LINK_DAYS.map((days) => ({ id: days, label: `${days} days` }));

/** The invite's link, shown once. Only its hash is kept, so it cannot be shown again. */
function NewInvite({ address, note }: Readonly<{ address: string | null; note: string | null }>) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div role="status" data-testid="share-invite-made" className="flex flex-col gap-2 rounded-lg bg-ok-wash px-4 py-3 text-sm text-ok">
      <p>
        <strong className="font-semibold">They are on the list.</strong> {note ?? "We emailed them the link."}
      </p>
      {address ? (
        <div className="flex flex-wrap gap-2">
          <input
            readOnly
            value={address}
            aria-label="Invite link"
            data-testid="share-invite-address"
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-3 font-mono text-[13px] text-ink"
          />
          <Button type="button" variant="secondary" onClick={copy}>
            {copied ? "Copied" : "Copy invite link"}
          </Button>
        </div>
      ) : null}
      <p>The link is shown only this once.</p>
    </div>
  );
}

export function InviteForm({ projectId }: Readonly<{ projectId: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(inviteToShareAction);
  const [access, setAccess] = useState<string>(SHARE_ACCESS[0]);
  const chosen = SHARE_ACCESS.find((id) => id === access) ?? SHARE_ACCESS[0];
  return (
    <div className="flex flex-col gap-3">
      <form ref={form} action={submit} className="flex flex-col gap-3" noValidate>
        <input type="hidden" name="projectId" value={projectId} />
        <Field name="email" label="Invite by email" type="email" autoComplete="off" placeholder="name@club.org" errors={fieldErrors("email")} />
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            name="access"
            label="They can"
            options={ACCESS_OPTIONS}
            value={access}
            onChange={(event) => setAccess(event.currentTarget.value)}
            errors={fieldErrors("access")}
          />
          <SelectField name="days" label="Invite works for" options={DAY_OPTIONS} defaultValue={DEFAULT_LINK_DAYS} errors={fieldErrors("days")} />
        </div>
        <p className="text-sm text-muted" data-testid="share-access-note">
          {ACCESS_NOTES[chosen]}
        </p>
        <Field name="message" label="Message (optional)" maxLength={MESSAGE_MAX} autoComplete="off" errors={fieldErrors("message")} />
        <Button type="submit" pending={pending}>
          {pending ? "Inviting" : "Send the invite"}
        </Button>
      </form>
      <FormSummary message={summary} />
      {state.result?.success ? <NewInvite key={state.attempt} address={state.result.data.address} note={state.result.data.emailNote} /> : null}
    </div>
  );
}
