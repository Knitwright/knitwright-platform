"use client";

import { useEffect, useState } from "react";
import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { TEXT_AREA } from "@/components/ui/field-styles";
import {
  applyAnswersAction,
  chaseByEmailAction,
  createSignupLinkAction,
  pasteSquadListAction,
  revokeSignupLinkAction,
} from "@/lib/clubs/signup/actions";
import { fillTemplate, whatsAppAddress, type ChaseTemplate } from "@/lib/clubs/signup/chase";
import { PASTE_MAX } from "@/lib/clubs/signup/fields";
import type { Grid, GridRow } from "@/lib/clubs/signup/grid";
import type { NumberRule } from "@/lib/clubs/signup/numbers";
import { CollectedGrid } from "./CollectedGrid";
import { NewLinkBox } from "./NewLinkBox";

export interface SeasonCollect {
  readonly seasonId: string;
  readonly name: string;
  readonly sport: string;
  readonly hasOpenLink: boolean;
  readonly openLinkId: string | null;
  readonly expiresAt: string | null;
  readonly grid: Grid;
}

type SignupPanelProps = Readonly<{
  season: SeasonCollect;
  rules: readonly NumberRule[];
  templates: readonly ChaseTemplate[];
  clubName: string;
}>;

const date = (iso: string): string => iso.slice(0, 10);

/** Making the season's link. Making another withdraws the one before it, so there is only ever one. */
function MakeLink({ season, rules, onMade }: Readonly<{ season: SeasonCollect; rules: readonly NumberRule[]; onMade: (address: string) => void }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(createSignupLinkAction);
  const made = state.result?.success ? state.result.data : null;
  // Lifted after the render, never during it: the chase links below need the address, and the
  // address is shown only once.
  useEffect(() => {
    if (made) onMade(made.address);
  }, [made, onMade]);
  return (
    <div className="flex flex-col gap-3">
      <form ref={form} action={submit} className="flex flex-wrap items-end gap-3" noValidate>
        <input type="hidden" name="seasonId" value={season.seasonId} />
        <SelectField
          name="sport"
          label="Sport"
          hint="This decides which numbers a player may choose."
          options={rules.map((rule) => ({ id: rule.sport, label: rule.label }))}
          defaultValue={season.sport}
          errors={fieldErrors("sport")}
        />
        <Button type="submit" pending={pending}>
          {pending ? "Making the link" : season.hasOpenLink ? "Make a new link" : "Make a sign-up link"}
        </Button>
      </form>
      <FormSummary message={summary} />
      {made ? (
        <NewLinkBox key={state.attempt} address={made.address} label="Player sign-up link" testId="signup-link-address">
          <strong className="font-semibold">Your sign-up link is ready.</strong> Copy it now and send it to your squad
          yourself. It is shown only this once, and it works until {date(made.expiresAt)}.
        </NewLinkBox>
      ) : null}
    </div>
  );
}

/** The pasted list: one person per line, with a phone number or an email address if the club has one. */
function PasteList({ seasonId }: Readonly<{ seasonId: string }>) {
  const { form, state, submit, pending, summary, fieldErrors } = useFormAction(pasteSquadListAction);
  const result = state.result?.success ? state.result.data : null;
  return (
    <form ref={form} action={submit} className="flex flex-col gap-2" noValidate>
      <input type="hidden" name="seasonId" value={seasonId} />
      <label htmlFor={`paste-${seasonId}`} className="text-sm font-medium text-ink">
        Your squad, one per line
      </label>
      <textarea
        id={`paste-${seasonId}`}
        name="list"
        rows={5}
        maxLength={PASTE_MAX}
        placeholder={"Alex Morgan, +441632960000\nSam Kerr, sam@example.com\nJordan Nobbs"}
        aria-invalid={fieldErrors("list").length > 0 || undefined}
        className={TEXT_AREA}
        data-testid="signup-paste"
      />
      <Button type="submit" variant="secondary" pending={pending}>
        {pending ? "Reading the list" : "Use this list"}
      </Button>
      <FormSummary message={summary} />
      {result ? (
        <div role="status" className="flex flex-col gap-1 text-sm text-ink-2" data-testid="signup-paste-result">
          <p>{result.kept} on your list.</p>
          {result.duplicates.length > 0 ? <p className="text-warn">Listed twice, kept once: {result.duplicates.join(", ")}.</p> : null}
          {result.problems.map((problem) => (
            <p key={problem.line} className="text-warn">
              Line {problem.line}: {problem.message}
            </p>
          ))}
        </div>
      ) : null}
    </form>
  );
}

/** Chasing one person by email, through the provider interface. WhatsApp is a plain link beside it. */
function ChaseByEmail({ seasonId, requestId, link }: Readonly<{ seasonId: string; requestId: string; link: string }>) {
  const { form, state, submit, pending } = useFormAction(chaseByEmailAction);
  const answer = state.result?.success ? state.result.data : null;
  return (
    <form ref={form} action={submit} className="flex flex-col gap-1">
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="link" value={link} />
      <Button type="submit" variant="quiet" pending={pending}>
        {pending ? "Sending" : "Chase by email"}
      </Button>
      {answer && !answer.sent ? (
        <p role="status" className="text-sm text-muted">
          {answer.note}
        </p>
      ) : null}
      {answer?.sent ? (
        <p role="status" className="text-sm text-ok">
          Sent.
        </p>
      ) : null}
    </form>
  );
}

/** Folding the answers into the season's roster, through the club's own roster writer. */
function ApplyAnswers({ seasonId }: Readonly<{ seasonId: string }>) {
  const { form, state, submit, pending, summary } = useFormAction(applyAnswersAction);
  const result = state.result?.success ? state.result.data : null;
  return (
    <form ref={form} action={submit} className="flex flex-col gap-1" noValidate>
      <input type="hidden" name="seasonId" value={seasonId} />
      <Button type="submit" variant="secondary" pending={pending}>
        {pending ? "Putting them in" : "Put the answers in the roster"}
      </Button>
      <FormSummary message={summary} />
      {result ? (
        <p role="status" className="text-sm text-ink-2" data-testid="signup-applied">
          {result.summary}
        </p>
      ) : null}
    </form>
  );
}

/**
 * One season's sign-up (spec F-T4, plan v5 Z7, decision 0086): the link, the pasted list, who is in
 * and who is missing, the chase, and the fold into the roster.
 */
export function SignupPanel({ season, rules, templates, clubName }: SignupPanelProps) {
  const [address, setAddress] = useState("");
  const whatsapp = templates.find((template) => template.channel === "whatsapp");
  const words = (row: GridRow) => ({ player: row.name, club: clubName, season: season.name, link: address });

  const chase = (row: GridRow) => {
    if (row.state !== "missing") return null;
    const waAddress = whatsapp && address !== "" && row.phone !== "" ? whatsAppAddress(whatsapp, words(row), row.phone) : null;
    return (
      <div className="flex flex-wrap items-center gap-3">
        {waAddress ? (
          <a
            href={waAddress}
            target="_blank"
            rel="noreferrer noopener"
            className="soft-link inline-flex min-h-10 items-center text-sm text-cobalt-soft"
            data-testid="chase-whatsapp"
          >
            Chase on WhatsApp
          </a>
        ) : null}
        {row.requestId && row.email !== "" && address !== "" ? (
          <ChaseByEmail seasonId={season.seasonId} requestId={row.requestId} link={address} />
        ) : null}
        {address === "" ? <p className="text-sm text-muted">Make the link above first, then chase.</p> : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <MakeLink season={season} rules={rules} onMade={setAddress} />
      {season.hasOpenLink && season.expiresAt ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span data-testid="signup-link-state">A link is open until {date(season.expiresAt)}.</span>
          {season.openLinkId ? <RevokeLink seasonId={season.seasonId} linkId={season.openLinkId} /> : null}
        </div>
      ) : null}
      <PasteList seasonId={season.seasonId} />
      <CollectedGrid grid={season.grid}>{chase}</CollectedGrid>
      {season.grid.rows.some((row) => row.entry !== null) ? <ApplyAnswers seasonId={season.seasonId} /> : null}
      {whatsapp && address !== "" ? (
        <details className="rounded-xl border border-hairline">
          <summary className="flex min-h-10 cursor-pointer items-center px-3 text-sm text-muted">The words we send</summary>
          <p className="whitespace-pre-line border-t border-hairline p-3 text-sm text-ink-2" data-testid="chase-words">
            {fillTemplate(whatsapp.body, { player: "Alex", club: clubName, season: season.name, link: address })}
          </p>
        </details>
      ) : null}
    </div>
  );
}

function RevokeLink({ seasonId, linkId }: Readonly<{ seasonId: string; linkId: string }>) {
  const { form, submit, pending, summary } = useFormAction(revokeSignupLinkAction);
  return (
    <form ref={form} action={submit} className="flex flex-col gap-1">
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="linkId" value={linkId} />
      <Button type="submit" variant="quiet" pending={pending}>
        {pending ? "Withdrawing" : "Withdraw it"}
      </Button>
      <FormSummary message={summary} />
    </form>
  );
}
