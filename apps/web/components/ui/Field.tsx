import { useId, type InputHTMLAttributes } from "react";

type FieldProps = Readonly<
  Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
    name: string;
    label: string;
    hint?: string;
    errors?: readonly string[];
  }
>;

/**
 * A labelled input. Its hint and errors are tied to it for screen readers. Each field
 * gets an id of its own, so two forms on one page can both have a field called "name".
 */
export function Field({ name, label, hint, errors = [], ...rest }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors.length > 0 ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        name={name}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={describedBy}
        className="h-11 rounded-lg border border-hairline bg-surface px-3 text-[15px] text-ink placeholder:text-faint aria-[invalid]:border-warn"
      />
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {errorId ? (
        <p id={errorId} className="text-sm text-warn">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
