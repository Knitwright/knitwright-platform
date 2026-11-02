"use client";

import { useState } from "react";
import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import type { FormAction } from "@/lib/forms/form-state";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import {
  createCommitteeLinkAction,
  lockCommitteeVersionAction,
  revokeCommitteeLinkAction,
} from "@/lib/share/committee/actions";
import { COMMITTEE_SLOTS, NO_ANSWERS_YET } from "@/lib/share/committee/fields";
import type { CommitteeLink, CommitteeLock } from "@/lib/share/committee/service";
import { approvalsNewestFirst, countBySlot, leadingSlot, tallyLine } from "@/lib/share/committee/tally";
import { NewLinkBox } from "./NewLinkBox";

export interface CommitteeDesign {
  readonly projectId: string;
  readonly name: string;
  readonly currentVersion: number;
  readonly links: readonly CommitteeLink[];
  readonly lock: CommitteeLock | null;
}

type PanelProps = Readonly<{ design: CommitteeDesign }>;

const date = (iso: string): string => iso.slice(0, 10);

/** Choosing up to three saved versions to show, newest first. */
function MakeLink({ design }: PanelProps) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(createCommitteeLinkAction);
  const newest = Array.from({ length: Math.min(design.currentVersion, 12) }, (_, step) => design.currentVersion - step);
  const [chosen, setChosen] = useState<readonly number[]>([design.currentVersion]);
  const toggle = (version: number): void =>
    setChosen((was) => (was.includes(version) ? was.filter((entry) => entry !== version) : [...was, version].slice(0, COMMITTEE_SLOTS.length)));

  return (
    <div className="flex flex-col gap-3">
      <form ref={form} action={submit} className="flex flex-col gap-3" noValidate>
        <input type="hidden" name="projectId" value={design.projectId} />
        {chosen.map((version) => (
          <input key={version} type="hidden" name="versions" value={version} />
        ))}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-ink">
            Which versions? Up to {COMMITTEE_SLOTS.length}, in the order you tick them.
          </legend>
          <div className="flex flex-wrap gap-2">
            {newest.map((version) => (
              <label
                key={version}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-hairline px-3 text-sm text-ink has-[:checked]:border-cobalt-soft"
              >
                <input type="checkbox" checked={chosen.includes(version)} onChange={() => toggle(version)} className="size-4" />
                Version {version}
              </label>
            ))}
          </div>
          {fieldErrors("versions").length > 0 ? <p className="text-sm text-warn">{fieldErrors("versions").join(" ")}</p> : null}
        </fieldset>
        <Button type="submit" pending={pending} disabled={chosen.length === 0}>
          {pending ? "Making the link" : "Make a committee link"}
        </Button>
      </form>
      <FormSummary message={summary} />
      {state.result?.success ? (
        <NewLinkBox key={state.attempt} address={state.result.data.address} label="Committee link" testId="committee-link-address">
          <strong className="font-semibold">Your committee link is ready.</strong> Copy it now and send it to your committee
          yourself. It is shown only this once, and it works until {date(state.result.data.expiresAt)}.
        </NewLinkBox>
      ) : null}
    </div>
  );
}

/** One small form for one change to one link. */
function LinkAction<T>({
  action,
  projectId,
  linkId,
  version,
  label,
  busy,
}: Readonly<{
  action: FormAction<T>;
  projectId: string;
  linkId: string;
  version?: number;
  label: string;
  busy: string;
}>) {
  const { form, submit, pending, summary } = useFormAction(action);
  return (
    <form ref={form} action={submit} className="flex flex-col gap-1">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="linkId" value={linkId} />
      {version === undefined ? null : <input type="hidden" name="version" value={version} />}
      <Button type="submit" variant="secondary" pending={pending}>
        {pending ? busy : label}
      </Button>
      <FormSummary message={summary} />
    </form>
  );
}

/** What one link collected: the tally, the pins and the approvals, each a record with a name and a time. */
function Collected({ design, link }: Readonly<{ design: CommitteeDesign; link: CommitteeLink }>) {
  const counts = countBySlot(link.slots, link.votes, link.approvals);
  const leading = leadingSlot(counts);
  const approvals = approvalsNewestFirst(link.approvals);
  const open = link.revokedAt === null && link.expiresAt > new Date().toISOString();
  return (
    <li className="flex flex-col gap-3 border-t border-hairline py-4" data-testid="committee-link" data-state={open ? "open" : "closed"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[15px] text-ink">
          {link.slots.map((slot) => `${slot.slot}: version ${slot.version}`).join(" · ")}
        </p>
        <p className="font-mono text-sm text-muted">
          made {date(link.createdAt)} · {link.revokedAt ? `withdrawn ${date(link.revokedAt)}` : `works until ${date(link.expiresAt)}`}
        </p>
      </div>

      <p className="text-sm text-muted" data-testid="committee-tally">
        {link.votes.length === 0 && link.pins.length === 0 && link.approvals.length === 0 ? NO_ANSWERS_YET : tallyLine(counts)}
      </p>

      {link.pins.length > 0 ? (
        <ul className="flex flex-col gap-2 text-sm">
          {link.pins.map((pin) => (
            <li key={pin.id} className="rounded-xl border border-hairline p-3" data-testid="committee-pin">
              <p className="text-ink-2">{pin.body}</p>
              <p className="mt-1 text-muted">
                {pin.name} · version {pin.version} · {pin.panelId} · {pin.xMm} mm across, {pin.yMm} mm down · {date(pin.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {approvals.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm" data-testid="committee-approvals">
          {approvals.map((approval) => (
            <li key={approval.id} className="text-ink-2">
              <strong className="font-medium text-ink">{approval.name}</strong> approved version {approval.version} on{" "}
              {approval.approvedAt.slice(0, 16).replace("T", " ")}
              {approval.email ? ` · ${approval.email}` : ""}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {open ? <LinkAction action={revokeCommitteeLinkAction} projectId={design.projectId} linkId={link.id} label="Withdraw" busy="Withdrawing" /> : null}
        {design.lock === null && leading !== null ? (
          <LinkAction
            action={lockCommitteeVersionAction}
            projectId={design.projectId}
            linkId={link.id}
            version={counts.find((count) => count.slot === leading)?.version}
            label={`Lock version ${counts.find((count) => count.slot === leading)?.version}`}
            busy="Locking"
          />
        ) : null}
      </div>
    </li>
  );
}

/**
 * One design's committee links (spec F-T3, plan v5 Z7, decision 0086). The kit manager sees the
 * comments, the votes and the approvals, and locks the version the committee chose, which moves
 * that version to status approved.
 */
export function CommitteePanel({ design }: PanelProps) {
  return (
    <div className="flex flex-col gap-4">
      {design.lock ? (
        <Notice tone="ok">
          <span data-testid="committee-lock">
            Version {design.lock.version} is locked, since {date(design.lock.lockedAt)}
            {design.lock.approvalId === null ? ", with no approval recorded against it" : ""}.
          </span>
        </Notice>
      ) : (
        <MakeLink design={design} />
      )}
      {design.links.length === 0 ? (
        <p className="text-[15px] text-muted">
          No committee link yet. Make one and send it to the people who decide.
        </p>
      ) : (
        <ul className="flex flex-col">
          {design.links.map((link) => (
            <Collected key={link.id} design={design} link={link} />
          ))}
        </ul>
      )}
    </div>
  );
}
