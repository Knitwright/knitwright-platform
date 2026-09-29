import { useId, type SelectHTMLAttributes } from "react";

type SelectFieldProps = Readonly<
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> & {
    name: string;
    label: string;
    hint?: string;
    errors?: readonly string[];
    options: readonly { readonly id: string; readonly label: string }[];
    /** Text of the empty first choice, shown until the person picks one. */
    placeholder?: string;
  }
>;

/** A labelled list of choices. Its hint and errors are tied to it for screen readers. */
export function SelectField({ name, label, hint, errors = [], options, placeholder, ...rest }: SelectFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors.length > 0 ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select
        {...rest}
        id={id}
        name={name}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={describedBy}
        className="h-11 rounded-lg border border-hairline bg-surface px-3 text-[15px] text-ink aria-[invalid]:border-warn"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
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
