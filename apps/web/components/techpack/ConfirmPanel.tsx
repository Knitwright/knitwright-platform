"use client";

import { Button } from "@/components/ui/Button";
import { confirmActions, confirmAllActions, type Confirmable } from "@/lib/projects/tech-pack-confirm";
import type { SectionId } from "@/lib/techpack";
import { useTechPackEdit } from "./TechPackEdit";

type ConfirmPanelProps = Readonly<{ sectionId: SectionId; items: readonly Confirmable[] }>;

const NOTHING_TO_DO = "This is yours already, or it is no longer in the design.";

/**
 * Everything in one section that a chart, the assistant or Knitwright suggested or proposed,
 * each with a button that makes it the person's own value. Confirming is not checking: the
 * value then reads "Typed in by you", and nothing reads as checked by a technician.
 */
export function ConfirmPanel({ sectionId, items }: ConfirmPanelProps) {
  const edit = useTechPackEdit();
  const shown = items.filter((item) => item.sectionId === sectionId);
  if (shown.length === 0) return null;

  const confirm = (item: Confirmable) => {
    const actions = confirmActions(edit.working, item.target);
    if (actions.length === 0) return edit.problem(item.key, NOTHING_TO_DO);
    edit.clearProblem(item.key);
    edit.saveMany(item.key, actions);
  };
  const allKey = `confirm:${sectionId}:all`;
  const confirmAll = () => {
    const actions = confirmAllActions(edit.working, shown.map((item) => item.target));
    if (actions.length === 0) return edit.problem(allKey, NOTHING_TO_DO);
    edit.clearProblem(allKey);
    edit.saveMany(allKey, actions);
  };

  return (
    <div className="rounded-xl bg-warn-wash p-4" data-testid={`confirm-panel-${sectionId}`}>
      <h3 className="text-sm font-semibold text-ink">Suggested or proposed, and nobody has chosen them</h3>
      <p className="mt-1 text-sm text-muted">
        Confirm one to make it your own value, or change it in the form below.
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {shown.map((item) => {
          const error = edit.errorFor(item.key);
          return (
            <li key={item.key} className="flex flex-wrap items-center justify-between gap-3" data-field={item.key}>
              <span className="flex flex-col">
                <span className="text-[15px] text-ink">{item.label}</span>
                <span className="text-xs text-warn">{item.source}</span>
                {error ? (
                  <span role="alert" className="text-sm text-warn">
                    {error}
                  </span>
                ) : null}
              </span>
              <Button type="button" variant="secondary" pending={edit.busy} onClick={() => confirm(item)} aria-label={`Confirm ${item.label}`}>
                Confirm
              </Button>
            </li>
          );
        })}
      </ul>
      {shown.length > 1 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3" data-field={allKey}>
          <Button type="button" variant="secondary" pending={edit.busy} onClick={confirmAll}>
            {`Confirm all ${shown.length} in this section`}
          </Button>
          {edit.errorFor(allKey) ? (
            <span role="alert" className="text-sm text-warn">
              {edit.errorFor(allKey)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
