"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MAX_BATCH_ACTIONS } from "@/lib/projects/schemas";
import { confirmAllActions, type Confirmable } from "@/lib/projects/tech-pack-confirm";
import { suggestedValueCount } from "@/lib/projects/tech-pack-sections";
import { useTechPackEdit } from "./TechPackEdit";

const KEY = "confirm:all";
const NOTHING_TO_DO = "These are yours already, or they are no longer in the design.";
const TOO_MANY = "There are too many suggestions to accept in one go. Accept them section by section instead.";

const valuesWords = (count: number): string => `${count} suggested ${count === 1 ? "value" : "values"}`;

/**
 * Makes every suggestion and proposal on the page the person's own, in one new version, so one
 * undo in the editor takes them all back. It asks first, in plain words, saying how many values it
 * sets. The changes are worked out from the design as it will be once the waiting changes are saved.
 */
export function AcceptAllSuggestions({ items }: Readonly<{ items: readonly Confirmable[] }>) {
  const edit = useTechPackEdit();
  const [asking, setAsking] = useState(false);
  const count = suggestedValueCount(items);
  const error = edit.errorFor(KEY);
  if (items.length === 0) return null;

  const accept = () => {
    setAsking(false);
    const actions = confirmAllActions(
      edit.working,
      items.map((item) => item.target),
    );
    if (actions.length === 0) return edit.problem(KEY, NOTHING_TO_DO);
    // One version holds a limited number of changes; more would need two undos, so none is sent.
    if (actions.length > MAX_BATCH_ACTIONS) return edit.problem(KEY, TOO_MANY);
    edit.clearProblem(KEY);
    edit.saveMany(KEY, actions);
  };

  return (
    <div className="flex flex-col gap-3" data-field={KEY}>
      {asking ? (
        <div role="group" aria-labelledby="accept-all-question" className="flex flex-col gap-3 rounded-2xl bg-tile p-4">
          <p id="accept-all-question" className="text-sm text-ink">
            {`Make all ${valuesWords(count)} your own? They are saved together as one new version, so one undo in the editor takes them all back.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" pending={edit.saving(KEY)} disabled={edit.busy} onClick={accept} className="h-10! px-4! text-sm!" data-testid="accept-all-yes">
              {`Accept all ${count}`}
            </Button>
            <Button type="button" variant="quiet" onClick={() => setAsking(false)} className="h-10! px-3! text-sm!">
              Not now
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          arrow
          pending={edit.saving(KEY)}
          disabled={edit.busy}
          onClick={() => setAsking(true)}
          className="w-full justify-between!"
          aria-describedby="accept-all-count"
          data-testid="accept-all"
        >
          Accept all suggestions
        </Button>
      )}
      <p id="accept-all-count" className="text-xs text-muted">
        {`${valuesWords(count)} from the starter chart, the assistant and Knitwright's proposals.`}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      ) : null}
    </div>
  );
}
