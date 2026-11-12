"use client";

import { Lock, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/Chips";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/Tooltip";
import type { Wearer } from "@/lib/garment";
import { designFromBaseAction } from "@/lib/products/actions";
import type { ChipGroup } from "@/lib/products/configurator";

/**
 * The product configurator (09 screen 28, prototype p04), opened by **Design this**. Left, the render; right, the
 * chips. A 🔒 chip is not sampled yet: it stays visible, cannot be picked, and its tooltip says why. **Create my
 * design** makes the design on this base with these options and opens it in the editor.
 */

type Props = Readonly<{
  code: string;
  name: string;
  groups: readonly ChipGroup[];
  /** Each option group's default, picked when the modal opens. */
  initial: Readonly<Record<string, string>>;
  wearers: readonly Readonly<{ id: Wearer; label: string }>[];
  render: Readonly<{ src: string; alt: string }> | null;
  /** Why a design cannot start here (a base with no garment yet), or null. */
  blocked: string | null;
  label?: string;
}>;

export function DesignThis({ label = "Design this", blocked, ...props }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" icon={<Icon icon={Pencil} size={20} />} disabledReason={blocked ?? undefined} onClick={() => setOpen(true)} className="w-full">
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={props.name} size="lg">
        <ConfiguratorBody {...props} blocked={blocked} />
      </Modal>
    </>
  );
}

function ConfiguratorBody({ code, groups, initial, wearers, render }: Props) {
  const [choices, setChoices] = useState<Readonly<Record<string, string>>>(initial);
  const [wearer, setWearer] = useState<Wearer>(wearers[0]?.id ?? "men");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const create = () =>
    start(async () => {
      setError(null);
      const result = await designFromBaseAction({ code, wearer, options: choices });
      if (result && !result.success) setError(result.error.message);
    });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="grid min-h-72 place-items-center rounded-2xl bg-soft p-6">
        {/* A data address drawn on the server. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {render ? <img src={render.src} alt={render.alt} className="h-auto w-3/4" /> : null}
      </div>
      <div className="flex flex-col gap-5">
        <p className="text-body-lg font-normal text-muted">Choose your options, then design it.</p>
        <ChipRow id="wearer" label="Made for" chips={wearers.map((w) => ({ value: w.id, label: w.label, locked: null }))} value={wearer} onPick={(value) => setWearer(value as Wearer)} />
        {groups.map((group) => (
          <ChipRow key={group.id} id={group.id} label={group.label} chips={group.chips} value={group.kind === "option" ? (choices[group.id] ?? null) : (group.chips.find((chip) => chip.isDefault)?.value ?? null)} onPick={group.kind === "option" ? (value) => setChoices({ ...choices, [group.id]: value }) : undefined} />
        ))}
        <p className="flex items-start gap-1.5 text-small text-muted">
          <Icon icon={Lock} size={16} className="mt-0.5 shrink-0" />
          Only options the factory has sampled can be picked. A locked option opens once a sample of it is signed off.
        </p>
        {error ? (
          <p role="alert" className="text-small text-bad">
            {error}
          </p>
        ) : null}
        <Button size="lg" arrow pending={pending} onClick={create} data-primary className="mt-auto w-full">
          {pending ? "Creating your design" : "Create my design"}
        </Button>
      </div>
    </div>
  );
}

type RowChip = Readonly<{ value: string; label: string; locked: string | null }>;

function ChipRow({ id, label, chips, value, onPick }: Readonly<{ id: string; label: string; chips: readonly RowChip[]; value: string | null; onPick?: (value: string) => void }>) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-small font-semibold text-text">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) =>
          chip.locked ? (
            <Tooltip key={chip.value} content={chip.locked}>
              <FilterChip label={chip.label} aria-disabled="true" icon={<Icon icon={Lock} size={14} />} className="cursor-not-allowed opacity-40" aria-label={`${chip.label}, locked: ${chip.locked}`} />
            </Tooltip>
          ) : (
            <FilterChip key={chip.value} label={chip.label} selected={chip.value === value} onClick={onPick ? () => onPick(chip.value) : undefined} aria-label={`${label}: ${chip.label}`} id={`${id}-${chip.value}`} />
          ),
        )}
      </div>
    </fieldset>
  );
}
