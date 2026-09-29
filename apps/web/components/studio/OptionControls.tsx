"use client";

import { useId, useState } from "react";
import type { OptionControl } from "@/lib/projects/controls";
import { ProvenanceBadge } from "./ProvenanceBadge";

type OptionControlsProps = Readonly<{
  controls: readonly OptionControl[];
  onChoose: (optionId: string, choiceId: string) => void;
  /** The message for a control that a change failed on, or null. */
  errorFor: (key: string) => string | null;
}>;

/**
 * One group of choices for every option of the garment. Nothing here names an option, a
 * choice or a garment: the registry decides what appears. A choice that would break a
 * rule is shown greyed out, with the reason beside it.
 */
export function OptionControls({ controls, onChoose, errorFor }: OptionControlsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {controls.map((control) => (
        <OptionGroup key={control.optionId} control={control} onChoose={onChoose} error={errorFor(fieldKey(control.optionId))} />
      ))}
    </div>
  );
}

export const fieldKey = (optionId: string): string => `option:${optionId}`;

type OptionGroupProps = Readonly<{
  control: OptionControl;
  onChoose: (optionId: string, choiceId: string) => void;
  error: string | null;
}>;

function OptionGroup({ control, onChoose, error }: OptionGroupProps) {
  const id = useId();
  const selectedId = control.choices.find((choice) => choice.selected)?.choiceId ?? null;
  // The choice is shown as soon as it is picked, before the server has answered.
  const [picked, setPicked] = useState<string | null>(null);
  const [seen, setSeen] = useState(selectedId);
  if (seen !== selectedId || (error && picked)) {
    setSeen(selectedId);
    setPicked(null);
  }

  const helpId = control.help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <fieldset
      data-field={fieldKey(control.optionId)}
      aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
      className="rounded-xl border border-hairline p-4"
    >
      <legend className="px-1 text-sm font-semibold text-ink">{control.label}</legend>
      {control.help ? (
        <p id={helpId} className="text-sm text-muted">
          {control.help}
        </p>
      ) : null}
      <div className="mt-2 flex flex-col gap-2">
        {control.choices.map((choice) => {
          const inputId = `${id}-${choice.choiceId}`;
          const reasonId = choice.available ? undefined : `${inputId}-reason`;
          return (
            <div key={choice.choiceId}>
              <label
                htmlFor={inputId}
                className={`flex items-start gap-3 text-[15px] ${choice.available ? "text-ink" : "text-faint"}`}
              >
                <input
                  id={inputId}
                  type="radio"
                  name={`${id}-choice`}
                  value={choice.choiceId}
                  checked={picked ? picked === choice.choiceId : choice.selected}
                  disabled={!choice.available}
                  aria-describedby={reasonId}
                  onChange={() => {
                    setPicked(choice.choiceId);
                    onChoose(control.optionId, choice.choiceId);
                  }}
                  className="mt-1 size-4 accent-cobalt"
                />
                <span>
                  {choice.label}
                  {choice.help ? <span className="block text-sm text-muted">{choice.help}</span> : null}
                </span>
              </label>
              {reasonId ? (
                <p id={reasonId} className="ml-7 mt-1 text-sm text-warn">
                  Not available. {choice.reason}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {control.suggestion ? (
        <p className="mt-3 text-sm text-warn">
          Suggested: {control.suggestion}. Choose an option to confirm it.
        </p>
      ) : null}
      <p className="mt-3">
        <ProvenanceBadge label={control.provenanceLabel} tone={control.tone} />
      </p>
      {error ? (
        <p id={errorId} className="mt-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
