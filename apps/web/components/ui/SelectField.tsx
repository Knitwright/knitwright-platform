import { useId, type SelectHTMLAttributes } from "react";
import { FIELD_CONTROL } from "./field-styles";

type Option = Readonly<{ id: string; label: string }>;
type Group = Readonly<{ label: string; options: readonly Option[] }>;

type SelectFieldProps = Readonly<
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> & {
    name: string;
    label: string;
    hint?: string;
    errors?: readonly string[];
    /** Plain choices, or choices gathered under headings. */
    options: readonly Option[] | readonly Group[];
    /** Text of the empty first choice, shown until the person picks one. */
    placeholder?: string;
  }
>;

const renderOption = (option: Option) => (
  <option key={option.id} value={option.id}>
    {option.label}
  </option>
);

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
        className={FIELD_CONTROL}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((entry) =>
          "options" in entry ? (
            <optgroup key={entry.label} label={entry.label}>
              {entry.options.map(renderOption)}
            </optgroup>
          ) : (
            renderOption(entry)
          ),
        )}
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
