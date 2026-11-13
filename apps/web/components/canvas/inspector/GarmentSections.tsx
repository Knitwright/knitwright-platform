"use client";

import { Check, CircleAlert, Lock, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { WhyButton } from "@/components/studio/editor/WhyButton";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { Select, Toggle } from "@/components/ui/Inputs";
import { Skeleton } from "@/components/ui/Skeleton";
import type { DesignChange, GarmentInspectorView, InspectorCheck, InspectorSlider } from "@/lib/inspector/types";
import { Row, Section } from "./parts";

/** The garment inspector's larger sections (decision 0147): range sliders, names and numbers, checks, and the loading state. */

export function LockLine({ note, ruleId, context }: Readonly<{ note: string | null; ruleId: string | null; context: string }>) {
  return (
    <p className="flex items-center gap-1 text-caption text-muted">
      <Icon icon={Lock} size={14} className="text-gold-3" />
      {note ?? "Not yet sampled"}
      {ruleId ? <WhyButton ruleId={ruleId} context={context} /> : null}
    </p>
  );
}

export function Slider({ slider, disabled, onCommit }: Readonly<{ slider: InspectorSlider; disabled: boolean; onCommit: (value: number) => void }>) {
  // Keyed on the stored value by its parent, so a save that moves the value starts this afresh.
  const [value, setValue] = useState(slider.value);
  const id = `slider-${slider.key}`;
  const commit = (): void => {
    if (value !== slider.value) onCommit(value);
  };
  return (
    <div className="flex flex-col gap-1" data-testid={`garment-slider-${slider.key}`}>
      <div className="flex items-center justify-between text-small">
        <label htmlFor={id} className="text-text">
          {slider.label}
        </label>
        <b className="text-text">{value === slider.value ? slider.valueText : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)} ${slider.unit}`}</b>
      </div>
      <input
        id={id}
        type="range"
        min={slider.min}
        max={slider.max}
        step={slider.step}
        value={value}
        disabled={disabled}
        aria-valuetext={`${slider.label} ${value} ${slider.unit}`}
        onChange={(event) => setValue(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="w-full accent-navy disabled:opacity-40"
      />
      <p className="flex flex-wrap items-center gap-1 text-caption text-muted">
        {slider.locked ? (
          <>
            <Icon icon={Lock} size={14} className="text-gold-3" />
            {slider.lockNote}
          </>
        ) : (
          slider.rangeText
        )}
        <WhyButton ruleId={slider.ruleId} context={`range ${slider.key}`} />
      </p>
    </div>
  );
}

export function NamesNumbers({ view, locked, apply }: Readonly<{ view: GarmentInspectorView; locked: boolean; apply: (change: DesignChange | null) => void }>) {
  const marks = view.namesNumbers;
  if (!marks.available) {
    return (
      <Section title="Names & numbers">
        <p className="text-small text-muted">This garment has no place for player names or numbers.</p>
      </Section>
    );
  }
  return (
    <Section
      title="Names & numbers"
      testId="garment-names-numbers"
      aside={<Toggle label="Names and numbers" hideLabel checked={marks.on} disabled={locked} onChange={(on) => apply(on ? marks.turnOn : marks.turnOff)} />}
    >
      {marks.on ? (
        <>
          <Select aria-label="Lettering style" value={marks.styleId} disabled={locked} onChange={(event) => apply(marks.withStyle[event.target.value] ?? null)}>
            <option value="" disabled>
              Choose a lettering style
            </option>
            {marks.styles.map((style) => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </Select>
          <Row label="Colour">{marks.colour || "Not set"}</Row>
          <Row label="Preview player">{marks.sample}</Row>
        </>
      ) : (
        <p className="text-small text-muted">Off. Turn it on to put player names and numbers in the garment&apos;s usual places.</p>
      )}
    </Section>
  );
}

const TONE_ICON = { ok: Check, warn: TriangleAlert, bad: X } as const;
const TONE_CLASS = { ok: "text-ok", warn: "text-warn", bad: "text-bad" } as const;
const TONE_WORDS = { ok: "Passed", warn: "Have a look", bad: "Must fix" } as const;

export function Checks({ view }: Readonly<{ view: GarmentInspectorView }>) {
  const checks = view.checks;
  return (
    <Section title="Checks" aside={<span className="mr-auto text-small text-muted" data-testid="garment-checks-summary">{checks.summary}</span>} testId="garment-checks">
      {checks.lines.length === 0 ? (
        <p className="flex items-center gap-2 text-small text-muted">
          <Icon icon={CircleAlert} size={16} />
          No validation result is stored for this version yet. Saving a change runs the checks.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {checks.lines.map((line) => (
            <CheckLine key={line.key} line={line} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function CheckLine({ line }: Readonly<{ line: InspectorCheck }>) {
  return (
    <li className="flex min-h-8 items-start gap-2 text-small" data-testid={`garment-check-${line.tone}`}>
      <Icon icon={TONE_ICON[line.tone]} size={16} className={cx("mt-0.5 shrink-0", TONE_CLASS[line.tone])} />
      <span className="min-w-0 flex-1 text-text">
        <span className="sr-only">{TONE_WORDS[line.tone]}: </span>
        {line.label}
        {line.target ? <span className="text-muted"> · {line.target}</span> : null}
      </span>
      {line.ruleId ? <WhyButton ruleId={line.ruleId} context={`check ${line.key}`} /> : null}
    </li>
  );
}

export function InspectorSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4" data-testid="garment-inspector-loading" aria-busy="true" aria-label="Loading the garment">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
