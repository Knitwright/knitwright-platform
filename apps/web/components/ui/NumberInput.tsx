"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { cx } from "./cx";
import { FIELD_CONTROL } from "./field-styles";
import { clamp, stepNumber } from "./keys";

/**
 * A number with its unit (docs/spec/10-design-system.md §8): measurements and mm positions.
 * Right-aligned tabular digits, the unit in `muted`, arrow keys step by 1 and Shift steps by 10.
 * The value is never rounded for display: what the factory set is what is shown (§1, 4).
 *
 * Controlled: `value` and `onChange`. Typing is kept as text until the field loses focus, so a
 * half-typed "12." is not thrown away.
 */

type NumberInputProps = Readonly<{
  value: number;
  onChange: (value: number) => void;
  unit: string;
  /** The field's name for screen readers. Use a visible <label htmlFor={id}> where there is room. */
  label: string;
  id?: string;
  min?: number;
  max?: number;
  step?: number;
  bigStep?: number;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}>;

/** What a typed text means, or null when it is not a number. */
export const parseTyped = (text: string): number | null => {
  const cleaned = text.trim().replace(",", ".");
  if (cleaned === "" || !/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
};

export function NumberInput({ value, onChange, unit, label, id, min, max, step = 1, bigStep = 10, disabled, invalid, className }: NumberInputProps) {
  const own = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const typed = draft === null ? null : parseTyped(draft);
    if (typed !== null) onChange(clamp(typed, min, max));
    setDraft(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commit();
    const next = stepNumber(draft === null ? value : (parseTyped(draft) ?? value), event.key, event.shiftKey, { min, max, step, bigStep });
    if (next === null) return;
    event.preventDefault();
    setDraft(null);
    onChange(next);
  };
  return (
    <span className={cx("relative flex w-full", className)}>
      <input
        id={id ?? own}
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuetext={`${value} ${unit}`}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className={cx(FIELD_CONTROL, "w-full pr-12 text-right tabular-nums")}
      />
      <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-body text-muted">
        {unit}
      </span>
    </span>
  );
}
