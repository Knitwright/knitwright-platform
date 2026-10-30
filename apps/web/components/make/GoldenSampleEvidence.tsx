"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { addGoldenSamplePomAction, addGoldenSampleReadingAction } from "@/lib/make/actions";
import { deltaVerdict, pomVerdict } from "@/lib/make/judge";
import type { GoldenSampleView } from "@/lib/make/service";

type Props = Readonly<{
  projectId: string;
  sample: GoldenSampleView;
  sizes: readonly string[];
  colourDeltaMax: number | null;
  onDone: () => void;
}>;

const whole = (text: string): number | null => {
  const value = Number(text.trim());
  return Number.isInteger(value) && value >= 0 ? value : null;
};

const decimal = (text: string): number | null => {
  const value = Number(text.trim());
  return Number.isFinite(value) && value >= 0 ? value : null;
};

/**
 * What the tape and the colour reading say, recorded against the golden sample being judged. Both are evidence:
 * once the golden sample is signed off the database takes nothing more, and neither row can ever be changed.
 */
export function GoldenSampleEvidence({ projectId, sample, sizes, colourDeltaMax, onDone }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <MeasurementForm projectId={projectId} sample={sample} sizes={sizes} onDone={onDone} />
      <ColourForm projectId={projectId} sample={sample} colourDeltaMax={colourDeltaMax} onDone={onDone} />
    </div>
  );
}

function MeasurementForm({ projectId, sample, sizes, onDone }: Omit<Props, "colourDeltaMax">) {
  const ids = { size: useId(), letter: useId(), code: useId(), measured: useId(), target: useId(), minus: useId(), plus: useId() };
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ sizeLabel: sizes[0] ?? "", letter: "", code: "", measured: "", target: "", minus: "", plus: "" });
  const [problem, setProblem] = useState<string | null>(null);
  const set = (key: keyof typeof form, value: string) => setForm((now) => ({ ...now, [key]: value }));

  const add = () => {
    const measuredMm = whole(form.measured);
    if (measuredMm === null) return setProblem("Give the millimetres the tape read, as a whole number.");
    if (form.letter.trim() === "" || form.code.trim() === "") return setProblem("Give the point's letter and its code.");
    start(async () => {
      const reply = await addGoldenSamplePomAction({
        projectId,
        goldenSampleId: sample.id,
        sizeLabel: form.sizeLabel,
        letter: form.letter.trim(),
        code: form.code.trim(),
        description: "",
        measuredMm,
        targetMm: whole(form.target),
        tolMinusMm: whole(form.minus),
        tolPlusMm: whole(form.plus),
        ruleId: "R-GAP-000",
      }).catch(() => null);
      if (!reply?.success) return setProblem(reply?.success === false ? reply.error.message : "The measurement could not be recorded.");
      setProblem(null);
      setForm((now) => ({ ...now, letter: "", code: "", measured: "", target: "", minus: "", plus: "" }));
      onDone();
    });
  };

  return (
    <section aria-labelledby="gs-poms" className="flex flex-col gap-3">
      <h3 id="gs-poms" className="text-sm font-medium text-ink">What the tape read</h3>
      <ul className="flex flex-col gap-1 text-[15px]">
        {sample.poms.map((pom) => {
          const verdict = pomVerdict(pom);
          return (
            <li key={pom.id} className="text-muted">
              <span className="text-ink">{pom.sizeLabel} · {pom.letter} {pom.code}:</span> {pom.measuredMm} mm.{" "}
              {verdict.status === "inside" ? verdict.text : verdict.finding.message} <span className="text-faint">({pom.ruleId})</span>
            </li>
          );
        })}
        {sample.poms.length === 0 ? <li className="text-muted">Nothing measured yet.</li> : null}
      </ul>

      <div className="grid gap-2 sm:grid-cols-3">
        <Field id={ids.size} label="Size">
          <select id={ids.size} className={FIELD_CONTROL} value={form.sizeLabel} onChange={(event) => set("sizeLabel", event.target.value)}>
            {sizes.length === 0 ? <option value="">No size run</option> : null}
            {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </Field>
        <Field id={ids.letter} label="Point">
          <input id={ids.letter} maxLength={2} className={FIELD_CONTROL} value={form.letter} onChange={(event) => set("letter", event.target.value)} placeholder="A" />
        </Field>
        <Field id={ids.code} label="Code">
          <input id={ids.code} maxLength={64} className={FIELD_CONTROL} value={form.code} onChange={(event) => set("code", event.target.value)} placeholder="chest_1cm_below_armhole" />
        </Field>
        <Field id={ids.measured} label="Measured, mm">
          <input id={ids.measured} inputMode="numeric" className={FIELD_CONTROL} value={form.measured} onChange={(event) => set("measured", event.target.value)} placeholder="532" />
        </Field>
        <Field id={ids.target} label="Should be, mm">
          <input id={ids.target} inputMode="numeric" className={FIELD_CONTROL} value={form.target} onChange={(event) => set("target", event.target.value)} placeholder="530" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field id={ids.minus} label="Tolerance minus">
            <input id={ids.minus} inputMode="numeric" className={FIELD_CONTROL} value={form.minus} onChange={(event) => set("minus", event.target.value)} placeholder="10" />
          </Field>
          <Field id={ids.plus} label="Tolerance plus">
            <input id={ids.plus} inputMode="numeric" className={FIELD_CONTROL} value={form.plus} onChange={(event) => set("plus", event.target.value)} placeholder="10" />
          </Field>
        </div>
      </div>
      <p className="text-sm text-faint">Leave a tolerance empty where the factory has not given one. Nothing is filled in for them.</p>
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
      <div><Button type="button" variant="secondary" pending={pending} onClick={add}>Record the measurement</Button></div>
    </section>
  );
}

function ColourForm({ projectId, sample, colourDeltaMax, onDone }: Omit<Props, "sizes">) {
  const ids = { name: useId(), delta: useId(), hex: useId(), instrument: useId(), white: useId(), observer: useId() };
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ colourName: "", deltaE: "", targetHex: "", instrument: "", whitePoint: "", observer: "" });
  const [problem, setProblem] = useState<string | null>(null);
  const set = (key: keyof typeof form, value: string) => setForm((now) => ({ ...now, [key]: value }));
  const text = (value: string): string | null => (value.trim() === "" ? null : value.trim());

  const add = () => {
    const deltaE = decimal(form.deltaE);
    if (deltaE === null) return setProblem("Give the Delta-E reading as a number.");
    if (form.colourName.trim() === "") return setProblem("Name the colour the reading is of.");
    start(async () => {
      const reply = await addGoldenSampleReadingAction({
        projectId,
        goldenSampleId: sample.id,
        colourName: form.colourName.trim(),
        deltaE,
        targetHex: text(form.targetHex),
        targetLab: null,
        measuredLab: null,
        instrument: text(form.instrument),
        whitePoint: text(form.whitePoint),
        observer: text(form.observer),
        ruleId: "R-GAP-000",
      }).catch(() => null);
      if (!reply?.success) return setProblem(reply?.success === false ? reply.error.message : "The reading could not be recorded.");
      setProblem(null);
      setForm({ colourName: "", deltaE: "", targetHex: "", instrument: "", whitePoint: "", observer: "" });
      onDone();
    });
  };

  return (
    <section aria-labelledby="gs-colour" className="flex flex-col gap-3">
      <h3 id="gs-colour" className="text-sm font-medium text-ink">What the colour reading says</h3>
      <ul className="flex flex-col gap-1 text-[15px]">
        {sample.readings.map((reading) => {
          const verdict = deltaVerdict(reading.colourName, reading.deltaE, colourDeltaMax, reading.ruleId);
          return (
            <li key={reading.id} className="text-muted">
              {verdict.status === "inside" ? verdict.text : verdict.finding.message}
              {reading.observer === null ? " Nobody stated the white point or the observer." : ` Stated as ${reading.whitePoint ?? "no white point"}, ${reading.observer}.`}
              <span className="text-faint"> ({reading.ruleId})</span>
            </li>
          );
        })}
        {sample.readings.length === 0 ? <li className="text-muted">No reading yet.</li> : null}
      </ul>

      <div className="grid gap-2 sm:grid-cols-3">
        <Field id={ids.name} label="Colour">
          <input id={ids.name} maxLength={60} className={FIELD_CONTROL} value={form.colourName} onChange={(event) => set("colourName", event.target.value)} placeholder="Club navy" />
        </Field>
        <Field id={ids.delta} label="Delta-E">
          <input id={ids.delta} inputMode="decimal" className={FIELD_CONTROL} value={form.deltaE} onChange={(event) => set("deltaE", event.target.value)} placeholder="1.24" />
        </Field>
        <Field id={ids.hex} label="Target colour">
          <input id={ids.hex} maxLength={7} className={FIELD_CONTROL} value={form.targetHex} onChange={(event) => set("targetHex", event.target.value)} placeholder="#0B1F4B" />
        </Field>
        <Field id={ids.instrument} label="Measured with">
          <input id={ids.instrument} maxLength={120} className={FIELD_CONTROL} value={form.instrument} onChange={(event) => set("instrument", event.target.value)} placeholder="Colour house report" />
        </Field>
        <Field id={ids.white} label="White point">
          <input id={ids.white} maxLength={40} className={FIELD_CONTROL} value={form.whitePoint} onChange={(event) => set("whitePoint", event.target.value)} placeholder="D65" />
        </Field>
        <Field id={ids.observer} label="Observer">
          <input id={ids.observer} maxLength={40} className={FIELD_CONTROL} value={form.observer} onChange={(event) => set("observer", event.target.value)} placeholder="2 degree" />
        </Field>
      </div>
      <p className="text-sm text-faint">Leave the white point and the observer empty unless whoever measured it stated them.</p>
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
      <div><Button type="button" variant="secondary" pending={pending} onClick={add}>Record the reading</Button></div>
    </section>
  );
}

function Field({ id, label, children }: Readonly<{ id: string; label: string; children: React.ReactNode }>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-ink">{label}</label>
      {children}
    </div>
  );
}
