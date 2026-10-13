import { useId, type InputHTMLAttributes } from "react";

type CheckboxFieldProps = Readonly<
  Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
    label: string;
    hint?: string;
    errors?: readonly string[];
  }
>;

/** A labelled checkbox, with its hint and errors tied to it for screen readers. */
export function CheckboxField({ label, hint, errors = [], ...rest }: CheckboxFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors.length > 0 ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        <input
          {...rest}
          id={id}
          type="checkbox"
          aria-invalid={errors.length > 0 || undefined}
          aria-describedby={describedBy}
          className="mt-0.5 size-5 shrink-0 accent-cobalt-soft"
        />
        <label htmlFor={id} className="text-[15px] leading-snug text-ink">
          {label}
        </label>
      </div>
      {hint ? (
        <p id={hintId} className="pl-8 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {errorId ? (
        <p id={errorId} className="pl-8 text-sm text-warn">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
