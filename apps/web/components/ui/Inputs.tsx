import { ChevronDown, Search } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cx } from "./cx";
import { FIELD_CONTROL, SEARCH_CONTROL } from "./field-styles";
import { Icon } from "./Icon";

/**
 * The plain inputs of docs/spec/10-design-system.md §8. Each is the bare control: put a label
 * beside it (`Field`, `SelectField` and `CheckboxField` wrap one with its label, hint and error).
 * `invalid` sets aria-invalid, which draws the `bad` border; the 12 px error line goes under the
 * field (§9 "Error (field)"), never only in a toast.
 */

type Invalid = Readonly<{ invalid?: boolean }>;

export function TextInput({ invalid, className, ...rest }: Readonly<InputHTMLAttributes<HTMLInputElement>> & Invalid) {
  return <input type="text" {...rest} aria-invalid={invalid || undefined} className={cx(FIELD_CONTROL, "w-full", className)} />;
}

/** The search field: 46 px, r-lg, the icon on the right, a `muted-2` placeholder. */
export function SearchInput({ className, ...rest }: Readonly<Omit<InputHTMLAttributes<HTMLInputElement>, "type">>) {
  return (
    <span className={cx("relative flex w-full", className)}>
      <input type="search" {...rest} className={cx(SEARCH_CONTROL, "w-full")} />
      <Icon icon={Search} size={20} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted" />
    </span>
  );
}

export function Select({
  invalid,
  className,
  children,
  ...rest
}: Readonly<SelectHTMLAttributes<HTMLSelectElement>> & Invalid & Readonly<{ children: ReactNode }>) {
  return (
    <span className={cx("relative flex w-full", className)}>
      <select {...rest} aria-invalid={invalid || undefined} className={cx(FIELD_CONTROL, "w-full appearance-none pr-10")}>
        {children}
      </select>
      <Icon icon={ChevronDown} size={16} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted" />
    </span>
  );
}

const CHOICE =
  "size-4.5 shrink-0 cursor-pointer accent-navy disabled:cursor-not-allowed disabled:opacity-40";

type ChoiceProps = Readonly<Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode }>;

/** A checkbox, 18 px, navy when checked, with its label. The whole row is the target (40 px high). */
export function Checkbox({ label, className, ...rest }: ChoiceProps) {
  return (
    <label className={cx("inline-flex min-h-10 cursor-pointer items-center gap-2.5 text-body text-text has-disabled:cursor-not-allowed has-disabled:text-muted-2", className)}>
      <input type="checkbox" {...rest} className={CHOICE} />
      <span>{label}</span>
    </label>
  );
}

/** A radio button, 18 px, navy when chosen. Give the radios of one choice the same `name`, inside a fieldset with a legend. */
export function Radio({ label, className, ...rest }: ChoiceProps) {
  return (
    <label className={cx("inline-flex min-h-10 cursor-pointer items-center gap-2.5 text-body text-text has-disabled:cursor-not-allowed has-disabled:text-muted-2", className)}>
      <input type="radio" {...rest} className={CHOICE} />
      <span>{label}</span>
    </label>
  );
}

type ToggleProps = Readonly<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The toggle's name, read by screen readers and shown beside it. */
  label: string;
  /** Hide the label visually (it is still read). */
  hideLabel?: boolean;
  disabled?: boolean;
  className?: string;
}>;

/** A toggle (§8): 36 × 20 px, r-full; off `border-strong`, on `navy`. It is a switch to a screen reader. */
export function Toggle({ checked, onChange, label, hideLabel = false, disabled = false, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "inline-flex min-h-10 items-center gap-2.5 text-body text-text disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-fast ease-out",
          checked ? "bg-navy" : "bg-border-strong",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-bg shadow-e1 transition-transform duration-fast ease-out",
            checked && "translate-x-4",
          )}
        />
      </span>
      <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
    </button>
  );
}
