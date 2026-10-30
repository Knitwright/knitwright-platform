"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL, TEXT_AREA } from "@/components/ui/field-styles";
import { addGoldenSamplePhotoAction, requestGoldenSampleChangesAction, signOffGoldenSampleAction, startGoldenSampleAction } from "@/lib/make/actions";
import type { MakeContext } from "@/lib/make/context";
import type { GoldenSampleView } from "@/lib/make/service";
import { GOLDEN_SAMPLE_STATE_LABELS, RATING_MAX, RATING_MIN } from "@/lib/make/vocabulary";
import { GoldenSampleEvidence } from "./GoldenSampleEvidence";

type Picture = Readonly<{ id: string; label: string }>;

type Props = Readonly<{
  context: MakeContext;
  /** The brand's own pictures, to attach one as the photo of the sample. */
  pictures: readonly Picture[];
  samples: readonly GoldenSampleView[];
  /** The samples sent to production that a golden sample can be judged from. */
  sampleRuns: readonly Readonly<{ id: string; label: string }>[];
  canJudge: boolean;
}>;

const RATINGS = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, index) => RATING_MIN + index);

/**
 * The golden sample (F-S7): the founder rates fit and colour and either signs it off or asks for changes, which
 * closes it and leaves the next draft of the design to be judged on its own.
 *
 * A sign-off needs a photo and at least one measurement behind it, and the database refuses one without them.
 */
export function GoldenSamplePanel({ context, pictures, samples, sampleRuns, canJudge }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const open = samples.find((one) => one.state === "draft") ?? null;
  const product = context.product;
  const runId = useId();
  const [chosenRun, setChosenRun] = useState(sampleRuns[0]?.id ?? "");

  const refresh = () => router.refresh();

  const begin = () => {
    if (!product || chosenRun === "") return setNote("Order a sample first: a golden sample is judged from one.");
    start(async () => {
      const reply = await startGoldenSampleAction({ projectId: context.projectId, productId: product.id, runId: chosenRun }).catch(() => null);
      setNote(reply?.success ? null : reply?.success === false ? reply.error.message : "The golden sample could not be started.");
      if (reply?.success) refresh();
    });
  };

  if (!canJudge) return <p className="text-sm text-muted">Only owners, admins and kit managers can judge a sample.</p>;

  return (
    <div className="flex flex-col gap-6">
      <History samples={samples} />
      {open === null ? (
        <section aria-labelledby="gs-start" className="flex flex-col gap-3">
          <h3 id="gs-start" className="text-sm font-medium text-ink">Judge a sample that has arrived</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-64 flex-col gap-1">
              <label htmlFor={runId} className="text-sm text-ink">The sample it came from</label>
              <select id={runId} className={FIELD_CONTROL} value={chosenRun} onChange={(event) => setChosenRun(event.target.value)}>
                {sampleRuns.length === 0 ? <option value="">No sample sent yet</option> : null}
                {sampleRuns.map((run) => <option key={run.id} value={run.id}>{run.label}</option>)}
              </select>
            </div>
            <Button type="button" pending={pending} disabled={sampleRuns.length === 0 || product === null} onClick={begin}>Start judging it</Button>
          </div>
          {note ? <Notice tone="warn" role="alert">{note}</Notice> : null}
        </section>
      ) : (
        <OpenSample context={context} sample={open} pictures={pictures} onDone={refresh} />
      )}
    </div>
  );
}

function History({ samples }: Readonly<{ samples: readonly GoldenSampleView[] }>) {
  if (samples.length === 0) return <p className="text-[15px] text-muted">No golden sample yet. A run needs one of the version being made.</p>;
  return (
    <ul className="flex flex-col gap-2 text-[15px]">
      {samples.map((sample) => (
        <li key={sample.id} className="text-muted">
          <span className="text-ink">Attempt {sample.version}, design version {sample.designVersion}:</span> {GOLDEN_SAMPLE_STATE_LABELS[sample.state]}
          {sample.approvedAt === null ? "" : ` on ${sample.approvedAt.slice(0, 10)}`}
          {sample.fitRating === null ? "" : ` · fit ${sample.fitRating} of ${RATING_MAX}, colour ${sample.colourRating} of ${RATING_MAX}`}
          {sample.notes === "" ? "" : ` · ${sample.notes}`}
          {sample.carriedTo.length === 0 ? "" : ` · carried forward to version ${sample.carriedTo.map((one) => one.toVersion).join(", ")}`}
        </li>
      ))}
    </ul>
  );
}

type OpenProps = Readonly<{ context: MakeContext; sample: GoldenSampleView; pictures: readonly Picture[]; onDone: () => void }>;

function OpenSample({ context, sample, pictures, onDone }: OpenProps) {
  const ids = { picture: useId(), fit: useId(), colour: useId(), notes: useId(), changes: useId() };
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const [picture, setPicture] = useState(pictures[0]?.id ?? "");
  const [fit, setFit] = useState("4");
  const [colour, setColour] = useState("4");
  const [notes, setNotes] = useState("");
  const [changes, setChanges] = useState("");

  const run = (what: () => Promise<{ success: boolean; error?: { message: string } }>) =>
    start(async () => {
      const reply = await what().catch(() => null);
      setProblem(reply?.success ? null : (reply?.error?.message ?? "That could not be recorded."));
      if (reply?.success) onDone();
    });

  const attach = () =>
    run(() => addGoldenSamplePhotoAction({ projectId: context.projectId, goldenSampleId: sample.id, fileId: picture, angle: "front", caption: "" }));

  const sign = () =>
    run(() => signOffGoldenSampleAction({ projectId: context.projectId, goldenSampleId: sample.id, fitRating: Number(fit), colourRating: Number(colour), notes }));

  const ask = () => run(() => requestGoldenSampleChangesAction({ projectId: context.projectId, goldenSampleId: sample.id, notes: changes }));

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-hairline bg-surface p-5">
      <p className="text-[15px] text-ink">Attempt {sample.version}, cut from design version {sample.designVersion}. {sample.photos.length} photo{sample.photos.length === 1 ? "" : "s"} on file.</p>

      <section aria-labelledby="gs-photo" className="flex flex-col gap-2">
        <h3 id="gs-photo" className="text-sm font-medium text-ink">A photo of the sample</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-64 flex-col gap-1">
            <label htmlFor={ids.picture} className="text-sm text-ink">One of your pictures</label>
            <select id={ids.picture} className={FIELD_CONTROL} value={picture} onChange={(event) => setPicture(event.target.value)}>
              {pictures.length === 0 ? <option value="">No picture uploaded yet</option> : null}
              {pictures.map((one) => <option key={one.id} value={one.id}>{one.label}</option>)}
            </select>
          </div>
          <Button type="button" variant="secondary" pending={pending} disabled={picture === ""} onClick={attach}>Attach it</Button>
        </div>
        <p className="text-sm text-faint">Upload the photo in the design&apos;s media screen first; it is then listed here.</p>
      </section>

      <GoldenSampleEvidence projectId={context.projectId} sample={sample} sizes={context.sizeRun} colourDeltaMax={context.factory.colourDeltaMax} onDone={onDone} />

      <section aria-labelledby="gs-rate" className="flex flex-col gap-3">
        <h3 id="gs-rate" className="text-sm font-medium text-ink">Your marks</h3>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.fit} className="text-sm text-ink">Fit, out of {RATING_MAX}</label>
            <select id={ids.fit} className={FIELD_CONTROL} value={fit} onChange={(event) => setFit(event.target.value)}>
              {RATINGS.map((mark) => <option key={mark} value={String(mark)}>{mark}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.colour} className="text-sm text-ink">Colour, out of {RATING_MAX}</label>
            <select id={ids.colour} className={FIELD_CONTROL} value={colour} onChange={(event) => setColour(event.target.value)}>
              {RATINGS.map((mark) => <option key={mark} value={String(mark)}>{mark}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.notes} className="text-sm text-ink">Anything to note</label>
          <textarea id={ids.notes} rows={2} maxLength={2000} className={TEXT_AREA} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <div><Button type="button" pending={pending} onClick={sign}>Sign this sample off</Button></div>
        <p className="text-sm text-faint">Signing off needs a photo and at least one measurement on file, and it moves the product to the run stage.</p>
      </section>

      <section aria-labelledby="gs-changes" className="flex flex-col gap-2">
        <h3 id="gs-changes" className="text-sm font-medium text-ink">Or ask for changes</h3>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.changes} className="text-sm text-ink">What has to change</label>
          <textarea id={ids.changes} rows={2} maxLength={2000} className={TEXT_AREA} value={changes} onChange={(event) => setChanges(event.target.value)} />
        </div>
        <div><Button type="button" variant="secondary" pending={pending} disabled={changes.trim() === ""} onClick={ask}>Ask for changes</Button></div>
        <p className="text-sm text-faint">This closes the golden sample. Change the design, order another sample, and judge that one.</p>
      </section>

      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
    </div>
  );
}
