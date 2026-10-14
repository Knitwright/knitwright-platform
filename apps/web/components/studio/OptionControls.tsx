"use client";

import { useId, type FocusEvent, type KeyboardEvent } from "react";
import type { ChoiceView, OptionControl } from "@/lib/projects/controls";
import { optionKey } from "./keys";
import { ProvenanceBadge } from "./ProvenanceBadge";

type OptionControlsProps = Readonly<{
  controls: readonly OptionControl[];
  /** The choice to show for a control: the one being saved, else the server's. */
  choiceShown: (optionId: string, serverChoice: string | null) => string | null;
  onChoose: (optionId: string, choiceId: string) => void;
  /** Called when the person settles: on Enter (asked) or when focus leaves the group. */
  onSettle: (optionId: string, asked: boolean) => void;
  errorFor: (key: string) => string | null;
}>;

/**
 * One group of choices for every option of the garment. Nothing here names an option, a
 * choice or a garment: the registry decides what appears. A choice that would break a
 * rule can still be reached with the keyboard, so its reason is heard, but it cannot be
 * picked.
 */
export function OptionControls({ controls, choiceShown, onChoose, onSettle, errorFor }: OptionControlsProps) {
  return (
    <div className="grid gap-4 @xl:grid-cols-2">
      {controls.map((control) => (
        <OptionGroup
          key={control.optionId}
          control={control}
          shown={choiceShown(control.optionId, control.choices.find((choice) => choice.selected)?.choiceId ?? null)}
          error={errorFor(optionKey(control.optionId))}
          onChoose={onChoose}
          onSettle={onSettle}
        />
      ))}
    </div>
  );
}

type OptionGroupProps = Readonly<{
  control: OptionControl;
  shown: string | null;
  error: string | null;
  onChoose: (optionId: string, choiceId: string) => void;
  onSettle: (optionId: string, asked: boolean) => void;
}>;

function OptionGroup({ control, shown, error, onChoose, onSettle }: OptionGroupProps) {
  const id = useId();
  const helpId = control.help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const leave = (event: FocusEvent<HTMLFieldSetElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) onSettle(control.optionId, false);
  };
  const enter = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    if (event.key === "Enter") onSettle(control.optionId, true);
  };

  return (
    <fieldset
      data-field={optionKey(control.optionId)}
      aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
      onBlur={leave}
      onKeyDown={enter}
      className="rounded-xl border border-hairline p-4"
    >
      <legend className="px-1 text-sm font-semibold text-ink">{control.label}</legend>
      {control.help ? <p id={helpId} className="text-sm text-muted">{control.help}</p> : null}
      <div className="mt-2 flex flex-col gap-2">
        {control.choices.map((choice) => (
          <ChoiceRow
            key={choice.choiceId}
            choice={choice}
            groupId={id}
            checked={shown === choice.choiceId}
            onPick={() => onChoose(control.optionId, choice.choiceId)}
          />
        ))}
      </div>
      <OptionFooter control={control} error={error} errorId={errorId} />
    </fieldset>
  );
}

type ChoiceRowProps = Readonly<{ choice: ChoiceView; groupId: string; checked: boolean; onPick: () => void }>;

function ChoiceRow({ choice, groupId, checked, onPick }: ChoiceRowProps) {
  const inputId = `${groupId}-${choice.choiceId}`;
  const reasonId = choice.available ? undefined : `${inputId}-reason`;
  return (
    <div>
      <label htmlFor={inputId} className={`flex items-start gap-3 text-[15px] ${choice.available ? "text-ink" : "text-muted"}`}>
        <input
          id={inputId}
          type="radio"
          name={`${groupId}-choice`}
          value={choice.choiceId}
          checked={checked}
          aria-disabled={choice.available ? undefined : true}
          aria-describedby={reasonId}
          onChange={() => (choice.available ? onPick() : undefined)}
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
}

type OptionFooterProps = Readonly<{ control: OptionControl; error: string | null; errorId?: string }>;

function OptionFooter({ control, error, errorId }: OptionFooterProps) {
  return (
    <>
      {control.suggestion ? (
        <p className="mt-3 text-sm text-warn">Suggested: {control.suggestion}. Choose an option to confirm it.</p>
      ) : null}
      <p className="mt-3">
        <ProvenanceBadge label={control.provenanceLabel} tone={control.tone} />
      </p>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
    </>
  );
}
