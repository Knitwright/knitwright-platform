"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CREST_ACCEPT, CREST_FORMATS_HINT } from "@/lib/crest-to-kit/crest";
import { CREST_LIMITS, FEEL_DEFINITIONS, ROLE_CHOICES, ROLE_LABELS, type FeelId, type RoleChoice } from "@/lib/crest-to-kit/settings";
import { HINTS, LABELS, NOTHING_STORED } from "@/lib/crest-to-kit/words";

/**
 * The intake of spec F-T2 steps 1 to 4: the crest or up to three colours, the club's name, the
 * sport, which kits, and how it should feel.
 *
 * Every control carries a real label tied to it, the file input keeps its own native affordance
 * (and says what it takes and that nothing is kept), the choices are radio groups inside a
 * fieldset with a legend, and the whole thing is one form, so Enter submits it and a screen reader
 * reads it in order. Nothing here holds the garment rules: the labels come from this workstream's
 * own settings and words, which import nothing heavy.
 */

export interface IntakeValues {
  readonly crest: File | null;
  readonly sportId: string;
  readonly roles: RoleChoice;
  readonly feel: FeelId;
  readonly clubName: string;
  readonly colours: readonly string[];
}

export type SportChoice = Readonly<{ id: string; label: string }>;
export type SwatchChoice = Readonly<{ name: string; swatch: string }>;

export type IntakeFormProps = Readonly<{
  sports: readonly SportChoice[];
  swatches: readonly SwatchChoice[];
  busy: boolean;
  /** True once kits have been shown, so the button says "Build them again". */
  built: boolean;
  onSubmit: (values: IntakeValues) => void;
}>;

/**
 * A chip whose own radio or checkbox covers it: the control is the chip, so a click anywhere on it
 * answers the question, the focus ring is drawn on the chip, and a screen reader reads the chip's
 * words as the control's name. The input is transparent rather than `sr-only`, because a control
 * clipped to a point is one a pointer, a touch and a browser test can all miss.
 */
const CHIP = "relative flex h-11 cursor-pointer items-center rounded-full border px-4 text-[15px] transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cobalt-soft";
const CHIP_INPUT = "absolute inset-0 size-full cursor-pointer appearance-none rounded-full opacity-0";
const CHIP_ON = "border-white/40 bg-white/15 text-ink";
const CHIP_OFF = "border-white/15 text-muted hover:border-white/25";

type ChipsProps<T extends string> = Readonly<{
  legend: string;
  name: string;
  value: T;
  options: readonly Readonly<{ id: T; label: string; hint?: string }>[];
  onChange: (value: T) => void;
}>;

/** One decision as a radio group of chips. The legend is the question a club is being asked. */
function Chips<T extends string>({ legend, name, value, options, onChange }: ChipsProps<T>) {
  const hintId = useId();
  const chosen = options.find((option) => option.id === value);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2" aria-describedby={chosen?.hint ? hintId : undefined}>
        {options.map((option) => (
          <label key={option.id} className={`${CHIP} ${option.id === value ? CHIP_ON : CHIP_OFF}`}>
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={option.id === value}
              onChange={() => onChange(option.id)}
              className={CHIP_INPUT}
            />
            {option.label}
          </label>
        ))}
      </div>
      {chosen?.hint ? (
        <p id={hintId} className="text-sm text-muted">
          {chosen.hint}
        </p>
      ) : null}
    </fieldset>
  );
}

/** The colour picker: up to three of the club colours Knitwright already names. */
function Colours({ swatches, chosen, onToggle }: Readonly<{ swatches: readonly SwatchChoice[]; chosen: readonly string[]; onToggle: (swatch: string) => void }>) {
  const hintId = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink">{LABELS.colours}</legend>
      <div className="flex flex-wrap gap-2" aria-describedby={hintId} data-testid="crest-to-kit-swatches">
        {swatches.map((entry) => {
          const on = chosen.includes(entry.swatch);
          return (
            <label key={entry.swatch} className={`${CHIP} gap-2 ${on ? CHIP_ON : CHIP_OFF}`}>
              <input type="checkbox" checked={on} onChange={() => onToggle(entry.swatch)} className={CHIP_INPUT} />
              <span aria-hidden="true" className="size-4 rounded-full border border-white/30" style={{ backgroundColor: entry.swatch }} />
              {entry.name}
              {on ? <span className="sr-only">, chosen</span> : null}
            </label>
          );
        })}
      </div>
      <p id={hintId} className="text-sm text-muted">
        {HINTS.colours}
      </p>
    </fieldset>
  );
}

export function IntakeForm({ sports, swatches, busy, built, onSubmit }: IntakeFormProps) {
  const fileId = useId();
  const fileHintId = useId();
  const [crest, setCrest] = useState<File | null>(null);
  const [sportId, setSportId] = useState(sports[0]?.id ?? "football");
  const [roles, setRoles] = useState<RoleChoice>("all");
  const [feel, setFeel] = useState<FeelId>("classic");
  const [clubName, setClubName] = useState("");
  const [colours, setColours] = useState<readonly string[]>([]);

  const toggle = (swatch: string): void =>
    setColours((chosen) =>
      chosen.includes(swatch) ? chosen.filter((one) => one !== swatch) : chosen.length >= CREST_LIMITS.maxPickedColours ? chosen : [...chosen, swatch],
    );

  return (
    <form
      className="flex flex-col gap-6"
      data-testid="crest-to-kit-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ crest, sportId, roles, feel, clubName, colours });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fileId} className="text-sm font-medium text-ink">
          {LABELS.crest}
        </label>
        <input
          id={fileId}
          type="file"
          name="file"
          accept={CREST_ACCEPT}
          disabled={busy}
          aria-describedby={fileHintId}
          onChange={(event) => setCrest(event.target.files?.[0] ?? null)}
          className="min-h-11 rounded-xl border border-hairline bg-white/[0.04] px-3 py-2 text-[15px] text-ink file:mr-3 file:h-8 file:rounded-full file:border file:border-white/20 file:bg-white/10 file:px-3 file:text-[13px] file:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft"
        />
        <p id={fileHintId} className="text-sm text-muted">
          {CREST_FORMATS_HINT} {NOTHING_STORED}
        </p>
      </div>

      <Colours swatches={swatches} chosen={colours} onToggle={toggle} />

      <Field name="clubName" label={LABELS.clubName} hint={HINTS.clubName} maxLength={CREST_LIMITS.maxClubNameLength} value={clubName} disabled={busy} onChange={(event) => setClubName(event.target.value)} />

      <Chips legend={LABELS.sport} name="sportId" value={sportId} options={sports} onChange={setSportId} />
      <Chips legend={LABELS.roles} name="roles" value={roles} options={ROLE_CHOICES.map((id) => ({ id, label: ROLE_LABELS[id] }))} onChange={setRoles} />
      <Chips
        legend={LABELS.feel}
        name="feel"
        value={feel}
        options={FEEL_DEFINITIONS.map((one) => ({ id: one.id, label: one.label, hint: one.hint }))}
        onChange={setFeel}
      />

      <div>
        <Button type="submit" pending={busy} arrow>
          {built ? LABELS.again : LABELS.submit}
        </Button>
      </div>
    </form>
  );
}
