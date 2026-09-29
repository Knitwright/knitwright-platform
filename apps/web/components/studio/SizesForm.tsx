"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { parseSizeLabels, sizingActionFromForm } from "@/lib/projects/sizing-form";
import type { SpecAction } from "@/lib/garment";

type SizesFormProps = Readonly<{
  initialText: string;
  initialBase: string;
  isSet: boolean;
  busy: boolean;
  onSave: (action: SpecAction) => void;
  errorFor: (key: string) => string | null;
  /** Reports a mistake found before anything is sent. */
  onInvalid: (key: string, message: string) => void;
}>;

export const SIZES_KEY = "sizes:list";
export const BASE_KEY = "sizes:base";

const HINT = "Write the sizes from smallest to largest and separate them with commas, for example S, M, L.";

/** Sets the size run of a design and which size the measurements below are for. */
export function SizesForm({ initialText, initialBase, isSet, busy, onSave, errorFor, onInvalid }: SizesFormProps) {
  const id = useId();
  const [text, setText] = useState(initialText);
  const [base, setBase] = useState(initialBase);
  const [seen, setSeen] = useState(`${initialText}|${initialBase}`);

  // Sizes changed on the server, for example by an undo, replace what is typed.
  if (seen !== `${initialText}|${initialBase}`) {
    setSeen(`${initialText}|${initialBase}`);
    setText(initialText);
    setBase(initialBase);
  }

  const labels = parseSizeLabels(text);
  const sizesError = errorFor(SIZES_KEY);
  const baseError = errorFor(BASE_KEY);

  const submit = () => {
    const result = sizingActionFromForm(text, base);
    if (result.ok) return onSave(result.action);
    if (result.errors.sizes) return onInvalid(SIZES_KEY, result.errors.sizes);
    if (result.errors.baseSize) onInvalid(BASE_KEY, result.errors.baseSize);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-start"
      noValidate
    >
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
          onChange={(event) => setText(event.target.value)}
          aria-invalid={sizesError ? true : undefined}
          aria-describedby={[`${id}-hint`, sizesError ? `${id}-list-error` : null].filter(Boolean).join(" ")}
          className="h-11 rounded-lg border border-hairline bg-surface px-3 text-[15px] text-ink aria-[invalid]:border-warn"
        />
        <p id={`${id}-hint`} className="text-sm text-muted">{HINT}</p>
        {sizesError ? <p id={`${id}-list-error`} className="text-sm text-warn">{sizesError}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-base`} className="text-sm font-medium text-ink">
          Base size
        </label>
        <select
          id={`${id}-base`}
          data-field={BASE_KEY}
          value={labels.includes(base) ? base : ""}
          onChange={(event) => setBase(event.target.value)}
          aria-invalid={baseError ? true : undefined}
          aria-describedby={baseError ? `${id}-base-error` : undefined}
          className="h-11 rounded-lg border border-hairline bg-surface px-3 text-[15px] text-ink aria-[invalid]:border-warn"
        >
          <option value="">Choose the base size</option>
          {labels.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        {baseError ? <p id={`${id}-base-error`} className="text-sm text-warn">{baseError}</p> : null}
      </div>
      <div className="sm:pt-[1.625rem]">
        <Button type="submit" variant="secondary" pending={busy}>
          {isSet ? "Change sizes" : "Save sizes"}
        </Button>
      </div>
    </form>
  );
}
