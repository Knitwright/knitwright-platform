"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
// Each module by name rather than the directory's barrel: the barrel reaches `runImport`, and from
// there zod and `sharp`, neither of which belongs in a browser bundle
// (`tests/architecture/client-weight.test.ts`, and decision 0108's note on `pictureDetail`).
import { decide, decideKind, itemsOfKind, tickRights } from "@/lib/brand-studio/import/decisions";
import type { ImportProposal, ImportRefusal } from "@/lib/brand-studio/import/types";
import { errorView, importView, type CompletionView } from "@/lib/brand-studio/import/view";
import { DECISION_LABELS, EMPTY_IMPORT } from "@/lib/brand-studio/import/words";
import { applyBrandImportAction, runBrandImportAction } from "@/lib/brand-studio/import-screen/actions";
import {
  COMPLETION_HEADING,
  KEEP_WHAT_I_CHOSE,
  NOTHING_CHOSEN,
  PICTURES_NOT_SAVED_YET,
  PICTURE_WIRING_GAP,
  RIGHTS_HEADING,
  RUN,
  RUNNING,
  RUN_TAKES_A_MINUTE,
  SAVE_FAILED,
  SAVING,
  STILL_TO_DO,
  URL_LABEL,
  URL_PLACEHOLDER,
  saved,
} from "@/lib/brand-studio/import-screen/words";
import { ImportGroup } from "./ImportGroups";
import { ImportStages } from "./ImportStages";

/**
 * THE BRAND IMPORT SCREEN (spec F-S9 phase 3; the renderer's contract is decision 0102 item 10;
 * built by decision 0108).
 *
 * L7 built the engine, the proposal and this screen's whole view model and owned no component
 * path, so nothing in the app ever called `runImport`. This is the renderer that contract asked
 * for, and it decides nothing: every line it shows comes from `importView`, `errorView`,
 * `emptyView` or `completionView`.
 *
 * Three things in it are the feature's honesty:
 *
 *   * **the rights box is labelled and starts unticked**, and only `tickRights` changes it;
 *   * **every row starts pending** and has its own Keep and Leave out, so an import is never all
 *     or nothing and nothing is taken in that a person did not choose;
 *   * **a picture is not stored by this screen**, and it says so plainly (`PICTURES_NOT_SAVED_YET`)
 *     rather than offering a tick that would do nothing.
 *
 * Secondary text is `text-ink-2` and an inline link is `text-ink` and underlined, both because the
 * dimmer tokens were measured and fail AA on this chrome.
 */

export const FIELD =
  "min-h-11 w-full min-w-0 rounded-xl border border-hairline bg-white/[0.04] px-4 text-[15px] text-ink focus-visible:border-cobalt-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft disabled:cursor-not-allowed disabled:opacity-55";

export const BUTTON =
  "chip-btn inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-5 text-[15px] font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft disabled:cursor-not-allowed disabled:opacity-55";

/** What an apply would save, read from the proposal the person has been shaping. */
const accepted = (proposal: ImportProposal, kind: "colour" | "font") => itemsOfKind(proposal, kind).filter((item) => item.decision === "accepted");

/** The three texts, when the person kept them. `acceptedStyle` of `apply.ts`, which the browser
 * may not load, says exactly this: the style row is one row, with the id `style:all`. */
const keptStyle = (proposal: ImportProposal) =>
  itemsOfKind(proposal, "style").some((item) => item.decision === "accepted") ? proposal.style : null;

export const changesOf = (proposal: ImportProposal) => ({
  url: proposal.url,
  style: keptStyle(proposal),
  // A colour row's label is its own `#rrggbb`, and a font row's id ends in its role.
  colours: accepted(proposal, "colour").map((item) => item.label),
  fonts: accepted(proposal, "font").flatMap((item) => {
    const font = proposal.fonts.find((one) => item.id === `font:${one.role}`);
    return font?.fontKey ? [{ role: font.role, fontKey: font.fontKey }] : [];
  }),
});

const savesNothing = (changes: ReturnType<typeof changesOf>): boolean =>
  changes.style === null && changes.colours.length === 0 && changes.fonts.length === 0;

type Props = Readonly<{ completion: CompletionView; canEdit: boolean }>;

export function ImportPanel({ completion, canEdit }: Props) {
  const urlId = useId();
  const [url, setUrl] = useState("");
  const [proposal, setProposal] = useState<ImportProposal | null>(null);
  const [refusal, setRefusal] = useState<ImportRefusal | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [running, startRun] = useTransition();
  const [storing, startStore] = useTransition();

  const run = () => {
    setNote(null);
    startRun(async () => {
      const result = await runBrandImportAction({ url });
      if (!result.success) {
        setProposal(null);
        setRefusal(null);
        setNote(result.error.message);
        return;
      }
      setProposal(result.data.ok ? result.data.proposal : null);
      setRefusal(result.data.ok ? null : result.data.refusal);
    });
  };

  const store = (current: ImportProposal) => {
    const changes = changesOf(current);
    if (savesNothing(changes)) {
      setNote(NOTHING_CHOSEN);
      return;
    }
    setNote(null);
    startStore(async () => {
      const result = await applyBrandImportAction(changes);
      if (!result.success) {
        setNote(SAVE_FAILED);
        return;
      }
      const parts = [
        ...(result.data.profile ? ["your visual style"] : []),
        ...(result.data.palette ? ["a palette"] : []),
        ...(result.data.fonts > 0 ? [`${result.data.fonts} type ${result.data.fonts === 1 ? "style" : "styles"}`] : []),
      ];
      setNote(saved(parts));
    });
  };

  const busy = running || storing || !canEdit;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="import-ask-heading" className="flex flex-col gap-3">
        <h2 id="import-ask-heading" className="text-[17px] font-medium text-ink">
          {EMPTY_IMPORT.heading}
        </h2>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-2">{EMPTY_IMPORT.body}</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={urlId} className="text-[13px] text-ink-2">
            {URL_LABEL}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id={urlId}
              type="url"
              inputMode="url"
              value={url}
              disabled={busy}
              placeholder={URL_PLACEHOLDER}
              onChange={(event) => setUrl(event.target.value)}
              className={`${FIELD} sm:max-w-md`}
              data-testid="import-url"
            />
            <button type="button" disabled={busy || url.trim() === ""} onClick={run} aria-busy={running || undefined} className={BUTTON} data-testid="import-run">
              {running ? RUNNING : RUN}
            </button>
          </div>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-2">{RUN_TAKES_A_MINUTE}</p>
        {note === null ? null : (
          <p role="status" className="rounded-2xl border border-cobalt-soft/30 bg-cobalt-wash px-4 py-3 text-[15px] leading-relaxed text-ink" data-testid="import-note">
            {note}
          </p>
        )}
      </section>

      {refusal === null ? null : <Refusal refusal={refusal} onRetry={run} busy={busy} />}

      {proposal === null ? null : (
        <Proposal proposal={proposal} busy={busy} storing={storing} onChange={setProposal} onStore={() => store(proposal)} />
      )}

      <Completion completion={completion} />
    </div>
  );
}

type ProposalProps = Readonly<{
  proposal: ImportProposal;
  busy: boolean;
  storing: boolean;
  onChange: (next: ImportProposal) => void;
  onStore: () => void;
}>;

/** Everything one proposal shows: the six stages, a group per kind, the rights row and the save. */
function Proposal({ proposal, busy, storing, onChange, onStore }: ProposalProps) {
  const rightsId = useId();
  const view = importView(proposal);
  return (
    <>
      <ImportStages stages={view.stages} progress={view.progress} />
      <p className="max-w-2xl text-[13px] leading-relaxed text-ink-2" data-testid="import-promise">
        {view.promise}
      </p>

      {view.groups.map((group) => (
        <ImportGroup
          key={group.kind}
          group={group}
          labels={DECISION_LABELS}
          busy={busy}
          onDecide={(id, decision) => onChange(decide(proposal, id, decision))}
          onKeepAll={() => onChange(decideKind(proposal, group.kind, "accepted"))}
        />
      ))}

      <section aria-labelledby="import-rights-heading" className="flex flex-col gap-2" data-testid="import-rights">
        <h3 id="import-rights-heading" className="text-[15px] font-medium text-ink">
          {RIGHTS_HEADING}
        </h3>
        <div className="flex items-start gap-2">
          <input
            id={rightsId}
            type="checkbox"
            checked={view.rights.ticked}
            disabled={busy}
            onChange={(event) => onChange(tickRights(proposal, event.target.checked))}
            className="mt-1 size-4 rounded border-hairline"
            data-testid="import-rights-tick"
          />
          <label htmlFor={rightsId} className="text-[15px] leading-relaxed text-ink">
            {view.rights.text}
          </label>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-2">{view.rights.ask}</p>
        {view.rights.because === null ? null : (
          <p className="text-[13px] leading-relaxed text-ink-2" data-testid="import-rights-because">
            {view.rights.because}
          </p>
        )}
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink-2" data-testid="import-pictures-gap">
          {PICTURES_NOT_SAVED_YET} <span className="font-mono">{PICTURE_WIRING_GAP.ruleId}</span>
        </p>
      </section>

      <button type="button" disabled={busy} onClick={onStore} aria-busy={storing || undefined} className={`${BUTTON} self-start`} data-testid="import-save">
        {storing ? SAVING : KEEP_WHAT_I_CHOSE}
      </button>
    </>
  );
}

function Refusal({ refusal, onRetry, busy }: Readonly<{ refusal: ImportRefusal; onRetry: () => void; busy: boolean }>) {
  const words = errorView(refusal);
  return (
    <section
      role="alert"
      aria-labelledby="import-refusal-heading"
      className="flex flex-col items-start gap-2 rounded-2xl border border-warn/30 bg-warn-wash px-4 py-3"
      data-testid="import-refusal"
    >
      <h3 id="import-refusal-heading" className="text-[15px] font-medium text-warn">
        {words.heading}
      </h3>
      <p className="max-w-2xl text-[15px] leading-relaxed text-warn">{words.body}</p>
      {words.retry === null ? null : (
        <button type="button" disabled={busy} onClick={onRetry} className={BUTTON} data-testid="import-retry">
          {words.retry}
        </button>
      )}
    </section>
  );
}

function Completion({ completion }: Readonly<{ completion: CompletionView }>) {
  return (
    <section aria-labelledby="import-completion-heading" className="flex flex-col gap-2" data-testid="import-completion">
      <h3 id="import-completion-heading" className="text-[15px] font-medium text-ink">
        {COMPLETION_HEADING}
      </h3>
      <p className="text-[15px] text-ink">{completion.percent}% complete</p>
      <p className="text-[13px] leading-relaxed text-ink-2">{completion.source}.</p>
      {completion.missing.length === 0 ? null : (
        <>
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-2">{STILL_TO_DO}</p>
          <ul className="flex flex-col gap-1.5">
            {completion.missing.map((line) => (
              <li key={line} className="text-[13px] leading-relaxed text-ink-2">
                {line}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-[13px] leading-relaxed text-ink-2">
        Everything here is also on{" "}
        <Link href="/brand-studio" className="font-medium text-ink underline underline-offset-4">
          your Brand Studio page
        </Link>
        , where you can type it in by hand.
      </p>
    </section>
  );
}
