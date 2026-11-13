"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Select, TextInput } from "@/components/ui/Inputs";
import { Notice } from "@/components/ui/Notice";
import type { Ladder } from "@/lib/factory/pricing";
import { openTeamStoreAction } from "@/lib/team-stores/actions";
import { DEFAULT_MIN_PIECES, MARGIN_BPS } from "@/lib/team-stores/constants";
import { defaultDates, previewPrice } from "@/lib/team-stores/preview";
import { marginPercent } from "@/lib/team-stores/rules";

type Props = Readonly<{
  projectId: string;
  designName: string;
  sizeRun: readonly string[];
  ladder: Ladder;
  seasons: readonly Readonly<{ id: string; name: string }>[];
  onOpened: () => void;
}>;

const LABEL = "flex flex-col gap-1 text-small text-text";

/**
 * OPEN A TEAM STORE (spec F-T6 step 1: "open and close dates, roster attached or open sign-up, optional club
 * margin (0/5/10/15/20%), and a minimum to proceed (default 10 pieces)"). The price line is worked out from the
 * design's own ladder as the kit manager types; the server works it out again and runs every order check before
 * the store opens.
 */
export function OpenStoreForm({ projectId, designName, sizeRun, ladder, seasons, onOpened }: Props) {
  const ids = { title: useId(), opens: useId(), closes: useId(), min: useId(), margin: useId(), season: useId(), sizes: useId() };
  const first = defaultDates(new Date());
  const [title, setTitle] = useState(designName.slice(0, 80));
  const [opensOn, setOpensOn] = useState(first.opensOn);
  const [closesOn, setClosesOn] = useState(first.closesOn);
  const [minPieces, setMinPieces] = useState(String(DEFAULT_MIN_PIECES));
  const [marginBps, setMarginBps] = useState<number>(0);
  const [namesNumbers, setNamesNumbers] = useState(true);
  const [seasonId, setSeasonId] = useState("");
  const [sizes, setSizes] = useState<readonly string[]>(sizeRun);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const preview = previewPrice(ladder, Number(minPieces), marginBps);

  const toggleSize = (size: string, on: boolean) => setSizes((current) => (on ? sizeRun.filter((one) => one === size || current.includes(one)) : current.filter((one) => one !== size)));

  const submit = async () => {
    setPending(true);
    setNote(null);
    const reply = await openTeamStoreAction({ projectId, title, opensOn, closesOn, minPieces: Number(minPieces), marginBps, namesNumbers, sizes: [...sizes], seasonId: seasonId || null }).catch(() => null);
    setPending(false);
    if (reply === null) return setNote("It could not be sent. Check your connection and try again.");
    if (!reply.success) return setNote(reply.error.message);
    onOpened();
  };

  return (
    <form
      className="flex flex-col gap-3 border-t border-border pt-4"
      aria-label="Open a team store"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h3 className="text-title text-text">Open a team store</h3>
      <label htmlFor={ids.title} className={LABEL}>
        Store name
        <TextInput id={ids.title} value={title} maxLength={80} required onChange={(event) => setTitle(event.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={ids.opens} className={LABEL}>
          Opens
          <TextInput id={ids.opens} type="date" value={opensOn} required onChange={(event) => setOpensOn(event.target.value)} />
        </label>
        <label htmlFor={ids.closes} className={LABEL}>
          Closes
          <TextInput id={ids.closes} type="date" value={closesOn} min={opensOn} required onChange={(event) => setClosesOn(event.target.value)} />
        </label>
        <label htmlFor={ids.min} className={LABEL}>
          Minimum pieces
          <TextInput id={ids.min} inputMode="numeric" value={minPieces} onChange={(event) => setMinPieces(event.target.value.replace(/\D/g, "").slice(0, 5))} />
        </label>
        <label htmlFor={ids.margin} className={LABEL}>
          Club margin
          <Select id={ids.margin} value={String(marginBps)} onChange={(event) => setMarginBps(Number(event.target.value))}>
            {MARGIN_BPS.map((bps) => (
              <option key={bps} value={bps}>
                {marginPercent(bps)}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <label htmlFor={ids.season} className={LABEL}>
        Roster
        <Select id={ids.season} value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>
          <option value="">Open to anyone with the link</option>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              Collect for {season.name}
            </option>
          ))}
        </Select>
      </label>
      <fieldset className="flex flex-col gap-1" aria-describedby={ids.sizes}>
        <legend className="text-small text-text">Sizes on offer</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {sizeRun.map((size) => (
            <Checkbox key={size} label={size} checked={sizes.includes(size)} onChange={(event) => toggleSize(size, event.target.checked)} />
          ))}
        </div>
        <p id={ids.sizes} className="text-caption text-muted">
          From this design&apos;s size run.
        </p>
      </fieldset>
      <Checkbox label="Names and numbers on each shirt" checked={namesNumbers} onChange={(event) => setNamesNumbers(event.target.checked)} />
      <p className={preview.ok ? "text-small text-text-2" : "text-small text-warn"} role="status" data-testid="team-store-price">
        {preview.text}
      </p>
      {note ? (
        <Notice tone="warn" role="alert">
          {note}
        </Notice>
      ) : null}
      <Button type="submit" pending={pending} disabledReason={preview.ok ? undefined : preview.text} className="self-start">
        {pending ? "Opening" : "Open store"}
      </Button>
    </form>
  );
}
