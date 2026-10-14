"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { SpecAction } from "@/lib/garment";
import { parseSizeLabels, sizingActionFromForm } from "@/lib/projects/sizing-form";
import { BASE_KEY, SIZES_KEY } from "./keys";

type SizesFormProps = Readonly<{
  initialText: string;
  initialBase: string;
  isSet: boolean;
  busy: boolean;
  onSave: (key: string, action: SpecAction) => void;
  errorFor: (key: string) => string | null;
  /** Reports a mistake found before anything is sent. The person asked, so focus moves to it. */
  onInvalid: (key: string, message: string) => void;
  onTyping: () => void;
  /** Must not change between draws: it is called from an effect that depends on it. */
  onDirty: (key: string, dirty: boolean) => void;
}>;

const HINT = "Write the sizes from smallest to largest and separate them with commas, for example S, M, L.";
const FIELD = "h-11 rounded-lg border border-hairline bg-surface px-3 text-[15px] text-ink aria-[invalid]:border-warn";

/** Sets the size run of a design and which size the measurements below are for. */
export function SizesForm(props: SizesFormProps) {
  const { initialText, initialBase, isSet, busy, onSave, onInvalid, onTyping, onDirty } = props;
  const [text, setText] = useState(initialText);
  const [base, setBase] = useState(initialBase);
  const [seen, setSeen] = useState(`${initialText}|${initialBase}`);

  // Sizes changed on the server, for example by an undo, replace what is typed.
  if (seen !== `${initialText}|${initialBase}`) {
    setSeen(`${initialText}|${initialBase}`);
    setText(initialText);
    setBase(initialBase);
  }
  const dirty = text.trim() !== initialText || base !== initialBase;
  useEffect(() => onDirty(SIZES_KEY, dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty(SIZES_KEY, false), [onDirty]);

  const submit = () => {
    const result = sizingActionFromForm(text, base);
    if (result.ok) return onSave(SIZES_KEY, result.action);
    if (result.errors.sizes) return onInvalid(SIZES_KEY, result.errors.sizes);
    if (result.errors.baseSize) onInvalid(BASE_KEY, result.errors.baseSize);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="grid gap-4 @lg:grid-cols-[1fr_12rem_auto] @lg:items-start"
      noValidate
    >
      <SizesList
        text={text}
        error={props.errorFor(SIZES_KEY)}
        onChange={(next) => {
          setText(next);
          onTyping();
        }}
      />
      <BaseSize labels={parseSizeLabels(text)} base={base} error={props.errorFor(BASE_KEY)} onChange={setBase} />
      <div className="@lg:pt-[1.625rem]">
        <Button type="submit" variant="secondary" pending={busy}>
          {isSet ? "Change sizes" : "Save sizes"}
        </Button>
      </div>
    </form>
  );
}

type SizesListProps = Readonly<{ text: string; error: string | null; onChange: (text: string) => void }>;

function SizesList({ text, error, onChange }: SizesListProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-list`} className="text-sm font-medium text-ink">
        Sizes, smallest first
      </label>
      <input
        id={`${id}-list`}
        data-field={SIZES_KEY}
        type="text"
        autoComplete="off"
        value={text}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[`${id}-hint`, error ? `${id}-list-error` : null].filter(Boolean).join(" ")}
        className={FIELD}
      />
      <p id={`${id}-hint`} className="text-sm text-muted">{HINT}</p>
      {error ? <p id={`${id}-list-error`} role="alert" className="text-sm text-warn">{error}</p> : null}
    </div>
  );
}

type BaseSizeProps = Readonly<{ labels: readonly string[]; base: string; error: string | null; onChange: (base: string) => void }>;

function BaseSize({ labels, base, error, onChange }: BaseSizeProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-base`} className="text-sm font-medium text-ink">
        Base size
      </label>
      <select
        id={`${id}-base`}
        data-field={BASE_KEY}
        value={labels.includes(base) ? base : ""}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-base-error` : undefined}
        className={FIELD}
      >
        <option value="">Choose the base size</option>
        {labels.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>
      {error ? <p id={`${id}-base-error`} role="alert" className="text-sm text-warn">{error}</p> : null}
    </div>
  );
}
