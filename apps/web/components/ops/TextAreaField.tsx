import { useId } from "react";
import { TEXT_AREA } from "@/components/ui/field-styles";

/** A labelled box of several lines for the ops forms, with its hint and errors tied to it. */
export function TextAreaField({ name, label, hint, errors = [], rows = 3, maxLength }: Readonly<{ name: string; label: string; hint?: string; errors?: readonly string[]; rows?: number; maxLength?: number }>) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, errors.length > 0 ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <textarea id={id} name={name} rows={rows} maxLength={maxLength} aria-invalid={errors.length > 0 || undefined} aria-describedby={describedBy} className={TEXT_AREA} />
      {hint ? <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p> : null}
      {errors.length > 0 ? <p id={`${id}-error`} className="text-sm text-warn">{errors.join(" ")}</p> : null}
    </div>
  );
}
