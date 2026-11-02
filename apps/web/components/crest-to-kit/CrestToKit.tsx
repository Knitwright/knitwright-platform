"use client";

import { useState } from "react";
import { Notice } from "@/components/ui/Notice";
import { askForKits } from "@/lib/crest-to-kit/client";
import type { KitsView } from "@/lib/crest-to-kit/view";
import { EMPTY_ACTION, EMPTY_BODY, EMPTY_TITLE, COLOUR_NOTE, kitsCount, NO_DATE_NOTE, PRICE_NOTE } from "@/lib/crest-to-kit/words";
import type { RoleChoice } from "@/lib/crest-to-kit/settings";
import { IntakeForm, type IntakeValues, type SportChoice, type SwatchChoice } from "./IntakeForm";
import { KitGrid } from "./KitGrid";
import { PaletteStrip } from "./PaletteStrip";
import { Progress } from "./Progress";

/**
 * Crest to kit (spec F-T2), end to end: the intake on the left, the colours and the kits on the
 * right. On a phone they stack, with the form first, which is the order a club fills them in.
 *
 * The crest never becomes a stored file. It is sent once, read, and forgotten, and the kits come
 * back as the view model the server built, so the browser is never handed a kit it could change.
 *
 * Every state is on the screen: an empty state naming the one action that fills it, honest progress
 * while the kits are built, an error that says what to do, and the reason when a crest yields no
 * kits at all.
 */

const post = (input: string, init?: RequestInit) => fetch(input, init);

export type CrestToKitProps = Readonly<{
  sports: readonly SportChoice[];
  swatches: readonly SwatchChoice[];
}>;

export function CrestToKit({ sports, swatches }: CrestToKitProps) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [view, setView] = useState<KitsView | null>(null);
  const [roles, setRoles] = useState<RoleChoice>("all");

  const build = async (values: IntakeValues): Promise<void> => {
    setProblem(null);
    setBusy(true);
    setRoles(values.roles);
    const outcome = await askForKits(post, {
      crest: values.crest,
      sportId: values.sportId,
      roles: values.roles,
      feel: values.feel,
      clubName: values.clubName,
      colours: values.colours,
    });
    setBusy(false);
    if (outcome.ok) setView(outcome.data);
    else {
      setView(null);
      setProblem(outcome.reason);
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10" data-testid="crest-to-kit">
      <div className="min-w-0">
        <IntakeForm
          sports={sports}
          swatches={swatches}
          busy={busy}
          built={view !== null}
          onSubmit={(values) => {
            void build(values);
          }}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {busy ? <Progress /> : null}

        {problem === null ? null : (
          <Notice tone="warn" role="alert">
            {problem}
          </Notice>
        )}

        {view === null && !busy && problem === null ? (
          <div className="flex flex-col items-start gap-2 rounded-2xl border border-hairline bg-surface p-6" data-testid="crest-to-kit-empty">
            <h2 className="text-lg font-medium text-ink">{EMPTY_TITLE}</h2>
            <p className="max-w-md text-[15px] leading-relaxed text-muted">{EMPTY_BODY}</p>
            <p className="text-[13px] text-faint">Press “{EMPTY_ACTION}” when your crest is chosen.</p>
          </div>
        ) : null}

        {view === null ? null : (
          <>
            {view.vectorise === null ? null : (
              <Notice tone={view.sharpEnough ? "info" : "warn"} role={view.sharpEnough ? "status" : "alert"}>
                {view.vectorise}
              </Notice>
            )}

            <PaletteStrip palette={view.palette} basis={view.colourBasis} />

            {view.status === "none" ? (
              <Notice tone="warn" role="alert">
                {view.reason}
              </Notice>
            ) : (
              <KitGrid kits={view.kits} count={kitsCount(view.kits.length, roles)} />
            )}

            {view.notes.length === 0 ? null : (
              <ul className="flex flex-col gap-1.5" data-testid="crest-to-kit-notes">
                {view.notes.map((note) => (
                  <li key={note} className="text-[13px] leading-relaxed text-warn">
                    {note}
                  </li>
                ))}
              </ul>
            )}

            <Notice>
              <p>{PRICE_NOTE}</p>
              <p className="mt-2">{NO_DATE_NOTE}</p>
              <p className="mt-2">{COLOUR_NOTE}</p>
            </Notice>
          </>
        )}
      </div>
    </div>
  );
}
