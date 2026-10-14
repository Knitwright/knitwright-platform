"use client";

import { useState } from "react";
import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { createShareLinkAction, moveShareLinkAction, revokeShareLinkAction } from "@/lib/share/actions";
import type { ShareLinkView } from "@/lib/share/responses";
import { DEFAULT_LINK_DAYS, LINK_DAYS } from "@/lib/share/fields";

type SharePanelProps = Readonly<{ projectId: string; links: readonly ShareLinkView[] }>;

const DAY_OPTIONS = LINK_DAYS.map((days) => ({ id: days, label: `${days} days` }));

/** The new link, shown once. Only its hash is kept, so it cannot be shown again. */
function NewLink({ address }: Readonly<{ address: string }>) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg bg-ok-wash px-4 py-3 text-sm text-ok">
      <p>
        <strong className="font-semibold">Your link is ready.</strong> Copy it now and send it to your committee
        yourself. Knitwright does not email anyone. The link is shown only this once.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          readOnly
          value={address}
          aria-label="Share link"
          data-testid="share-link-address"
          onFocus={(event) => event.currentTarget.select()}
          className="h-11 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-3 font-mono text-[13px] text-ink"
        />
        <Button type="button" variant="secondary" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}

function CreateLink({ projectId }: Readonly<{ projectId: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(createShareLinkAction);
  return (
    <div className="flex flex-col gap-3">
      <form ref={form} action={submit} className="flex flex-wrap items-end gap-3" noValidate>
        <input type="hidden" name="projectId" value={projectId} />
        <SelectField name="days" label="Link works for" options={DAY_OPTIONS} defaultValue={DEFAULT_LINK_DAYS} errors={fieldErrors("days")} />
        <Button type="submit" pending={pending}>
          {pending ? "Making the link" : "Make a share link"}
        </Button>
      </form>
      <FormSummary message={summary} />
      {state.result?.success ? <NewLink key={state.attempt} address={state.result.data.address} /> : null}
    </div>
  );
}

/** One small form for one change to one link. */
function LinkButton({
  action,
  projectId,
  linkId,
  label,
  busy,
}: Readonly<{
  action: typeof revokeShareLinkAction | typeof moveShareLinkAction;
  projectId: string;
  linkId: string;
  label: string;
  busy: string;
}>) {
  const { form, submit, pending, summary } = useFormAction<unknown>(action);
  return (
    <form ref={form} action={submit} className="flex flex-col gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="linkId" value={linkId} />
      <Button type="submit" variant="secondary" pending={pending}>
        {pending ? busy : label}
      </Button>
      <FormSummary message={summary} />
    </form>
  );
}

function LinkItem({ projectId, link }: Readonly<{ projectId: string; link: ShareLinkView }>) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-hairline p-4" data-testid="share-link" data-state={link.state}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 text-sm">
          <p className="text-ink">{link.createdSentence}</p>
          <p className={link.state === "open" ? "text-muted" : "text-warn"}>{link.stateSentence}</p>
        </div>
        {link.state === "open" ? (
          <div className="flex flex-wrap gap-2">
            {link.canMove ? (
              <LinkButton action={moveShareLinkAction} projectId={projectId} linkId={link.id} label={link.moveLabel} busy="Moving" />
            ) : null}
            <LinkButton action={revokeShareLinkAction} projectId={projectId} linkId={link.id} label="Revoke" busy="Revoking" />
          </div>
        ) : null}
      </div>
      <p className="text-[15px] font-medium text-ink" data-testid="share-tally">
        {link.tallySentence}
      </p>
      {link.comments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {link.comments.map((comment, index) => (
            <li key={`${comment.when}-${index}`} className="rounded-lg bg-shell px-3 py-2 text-sm">
              <p className="text-muted">
                {comment.name}
                {comment.voteLabel ? `, voted ${comment.voteLabel}` : ""}, {comment.when}
              </p>
              <p className="mt-1 whitespace-pre-line text-[15px] text-ink-2">{comment.comment}</p>
            </li>
          ))}
        </ul>
      ) : link.answerCount === 0 ? (
        <p className="text-sm text-muted">No answers yet.</p>
      ) : null}
    </li>
  );
}

/**
 * Share with your committee: a link to one version of the design that people without an account
 * can open, vote on and comment on. Guide module 4. The member sends the link themselves.
 */
export function SharePanel({ projectId, links }: SharePanelProps) {
  return (
    <section aria-labelledby="share-heading" className="grid gap-4 rounded-xl border border-hairline bg-surface p-6">
      <div className="grid gap-1">
        <h2 id="share-heading" className="text-lg font-semibold text-ink">
          Share with your committee
        </h2>
        <p className="text-sm text-muted">
          Make a link to this version of the design. Anyone with the link can see the drawings, colours and fabrics,
          and leave a vote and a comment. They do not see measurements, notes or files.
        </p>
      </div>
      <CreateLink projectId={projectId} />
      {links.length > 0 ? (
        <ul className="flex flex-col gap-3" aria-label="Share links">
          {links.map((link) => (
            <LinkItem key={link.id} projectId={projectId} link={link} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
