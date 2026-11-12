"use client";

import { Lock, Shirt as ShirtIcon } from "lucide-react";
import type { Route } from "next";
import { useId } from "react";
import { FilterChip } from "@/components/ui/Chips";
import { TEXT_AREA } from "@/components/ui/field-styles";
import { Icon } from "@/components/ui/Icon";
import { Select, TextInput, Toggle } from "@/components/ui/Inputs";
import { LinkButton } from "@/components/ui/LinkButton";
import type { Field } from "@/lib/ai-studio/forms";
import { Step } from "./WorkflowFrame";

/**
 * One field of a workflow form (`lib/ai-studio/forms.ts`), drawn from its kind. Choices are chips in
 * a labelled group, a product is a select of the brand's own designs with the garment-locked mark,
 * and a field's error sits under it (10 §9: never only in a toast).
 */

export type ProductOption = Readonly<{ id: string; name: string; garment: string; typeId: string }>;

type FieldProps = Readonly<{
  number: number;
  field: Field;
  value: string;
  error?: string;
  products: readonly ProductOption[];
  onChange: (value: string) => void;
}>;

function ProductField({ id, value, products, onChange }: Readonly<{ id: string; value: string; products: readonly ProductOption[]; onChange: (value: string) => void }>) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border-strong p-5">
        <p className="text-body text-muted">You have no designs yet. A workflow starts from one of your own designs.</p>
        <LinkButton href={"/studio/new" as Route} size="sm">
          Create your first kit
        </LinkButton>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="relative grid size-14 shrink-0 place-items-center rounded-lg bg-soft text-navy">
        <Icon icon={ShirtIcon} size={22} />
        <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-bg text-warn" title="Garment locked: the platform draws it, a model never does">
          <Icon icon={Lock} size={14} />
        </span>
      </span>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose one of your designs</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name} · {product.garment}
          </option>
        ))}
      </Select>
    </div>
  );
}

function Chips({ label, options, value, onChange }: Readonly<{ label: string; options: readonly { value: string; label: string }[]; value: string; onChange: (value: string) => void }>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <FilterChip key={option.value} label={option.label} selected={option.value === value} onClick={() => onChange(option.value)} />
      ))}
    </div>
  );
}

export function FormField({ number, field, value, error, products, onChange }: FieldProps) {
  const id = useId();
  switch (field.kind) {
    case "product":
      return (
        <Step number={number} label={field.label} htmlFor={products.length > 0 ? id : undefined} error={error}>
          <ProductField id={id} value={value} products={products} onChange={onChange} />
        </Step>
      );
    case "choice":
      return (
        <Step number={number} label={field.label} error={error}>
          <Chips label={field.label} options={field.options} value={value} onChange={onChange} />
        </Step>
      );
    case "text":
      return (
        <Step number={number} label={field.label} htmlFor={id} error={error}>
          {field.max > 120 ? (
            <textarea id={id} rows={4} maxLength={field.max} placeholder={field.placeholder} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={error ? true : undefined} className={`${TEXT_AREA} w-full`} />
          ) : (
            <TextInput id={id} maxLength={field.max} placeholder={field.placeholder} value={value} invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)} />
          )}
        </Step>
      );
    case "toggle":
      return (
        <Step number={number} label={field.label} error={error}>
          <Toggle checked={value === "on"} label={field.hint} onChange={(on) => onChange(on ? "on" : "off")} />
        </Step>
      );
    case "date":
      return (
        <Step number={number} label={field.label} htmlFor={id} error={error}>
          <TextInput id={id} type="date" value={value} invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)} />
        </Step>
      );
    case "fixed":
      return (
        <Step number={number} label={field.label}>
          <p className="text-body text-muted">{field.value}</p>
        </Step>
      );
  }
}
