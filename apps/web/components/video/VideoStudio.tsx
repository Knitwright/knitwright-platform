"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { containerNote, RECORDER_BITS_PER_SECOND, RECORDER_MIME_TYPES } from "@/lib/media/video/encoder";
import { VIDEO_FPS, type VideoAspect } from "@/lib/media/video/formats";
import { MAX_TURNTABLE_BYTES } from "@/lib/media/video/limits";
import type { SequenceKey, ViewCapability } from "@/lib/media/video/sequences";
import { findTemplate } from "@/lib/media/video/social-frames";
import * as copy from "./copy";
import { askAbilities, recordPlan } from "./record-sequence";
import { studioPlan, studioView, type Phase, type SequenceCard, type StudioView, type TemplateCard } from "./studio-model";

/**
 * THE FREE DETERMINISTIC VIDEOS (spec F-L3) and the social frames of `07`.
 *
 * The plan is built on the server's own rules (`lib/media/video/shot-plan.ts`), the 3D view plays it,
 * and this browser records it: the encoder decision of 0095, which is the option that works on every
 * deploy target. Nothing paid is called, so nothing is charged.
 *
 * It asks the view what it can do before it offers anything, and a sequence the view cannot record is
 * shown disabled with the reason. The video is handed straight to the person as a file; a turntable
 * can also be kept in the design's media set through the route that already exists (decision 0058).
 */

export type VideoStudioProps = Readonly<{
  /** The design this studio belongs to, for the media-set save. */
  projectId?: string;
  /** The 3D canvas. Found on the page when it is not given (the end-to-end test gives one). */
  canvas?: HTMLCanvasElement | null;
}>;

const CHIP = "chip-btn inline-flex min-h-10 items-center rounded-full border border-white/20 px-3.5 text-[13px] text-ink disabled:opacity-55";
const CHOSEN = "border-cobalt-soft bg-cobalt-wash";
const H4 = "text-[13px] font-medium text-ink";
const HINT = "text-[12px] leading-relaxed text-ink-2";

const find3dCanvas = (): HTMLCanvasElement | null =>
  document.querySelector<HTMLCanvasElement>('[data-testid="garment-3d"] canvas, [data-testid="gltf-3d"] canvas');

export default function VideoStudio({ projectId, canvas }: VideoStudioProps) {
  const [view3d, setView3d] = useState<Readonly<{ hasView: boolean; abilities: readonly ViewCapability[] }> | null>(null);
  const [aspect, setAspect] = useState<VideoAspect>("9:16");
  const [sequenceKey, setSequenceKey] = useState<SequenceKey>("turntable");
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [text, setText] = useState<Readonly<Record<string, string>>>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<Readonly<{ url: string; note: string }> | null>(null);
  const made = useRef<string | null>(null);

  const read = useCallback((): HTMLCanvasElement | null => canvas ?? find3dCanvas(), [canvas]);

  // The 3D canvas is drawn by another component, so it may not be on the page yet. Reading it and
  // asking what it can do is a question to something outside React, asked once the page has drawn.
  useEffect(() => {
    const timer = setTimeout(() => {
      const found = read();
      setView3d({ hasView: found !== null, abilities: found ? askAbilities(found) : [] });
    }, 0);
    return () => clearTimeout(timer);
  }, [read]);

  useEffect(
    () => () => {
      if (made.current) URL.revokeObjectURL(made.current);
    },
    [],
  );

  const abilities = view3d?.abilities ?? [];
  const hasView = view3d?.hasView ?? false;
  const view = studioView({ abilities, hasView, aspect, sequenceKey, templateKey, phase, message });

  async function record(): Promise<void> {
    const found = read();
    const plan = studioPlan({ abilities, hasView, aspect, sequenceKey, templateKey, phase, message: null }, text);
    if (!found || !plan) return setMessage(copy.UNSUPPORTED_LINE);
    setMessage(null);
    setPhase("recording");
    const outcome = await recordPlan(found, plan, {
      mimeTypes: RECORDER_MIME_TYPES,
      bitsPerSecond: RECORDER_BITS_PER_SECOND,
      fps: VIDEO_FPS,
      maxBytes: MAX_TURNTABLE_BYTES,
    });
    setPhase(outcome.ok ? "saved" : "failed");
    if (!outcome.ok) {
      setMessage(outcome.reason === "unsupported" ? copy.UNSUPPORTED_LINE : outcome.reason === "too_large" ? copy.TOO_BIG_LINE : copy.RECORD_FAILED_LINE);
      return;
    }
    if (made.current) URL.revokeObjectURL(made.current);
    made.current = URL.createObjectURL(outcome.video);
    setFile({ url: made.current, note: containerNote(outcome.mimeType) });
    setMessage(copy.SAVED_LINE);
  }

  const slots = findTemplate(templateKey)?.slots ?? [];

  return (
    <section aria-label={copy.STUDIO_HEADING} data-testid="video-studio" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h3 className="text-[15px] font-medium text-ink">{view.heading}</h3>
        <p className={HINT}>{view.lead}</p>
        <p className={HINT}>{view.encoder.reason}</p>
      </header>

      {view.empty ? (
        <div className="flex flex-col gap-1 rounded-2xl border border-white/15 bg-white/[0.03] p-3" data-testid="studio-empty">
          <h4 className={H4}>{view.empty.title}</h4>
          <p className={HINT}>{view.empty.line}</p>
        </div>
      ) : (
        <>
          <Sequences view={view} onPick={setSequenceKey} />
          <fieldset className="flex flex-col gap-2" data-testid="studio-aspects">
            <legend className={H4}>{copy.ASPECT_HEADING}</legend>
            <ul className="flex flex-wrap gap-2">
              {view.aspects.map((choice) => (
                <li key={choice.aspect}>
                  <button type="button" aria-pressed={choice.selected} onClick={() => setAspect(choice.aspect)} className={`${CHIP} ${choice.selected ? CHOSEN : ""}`}>
                    {choice.label}
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
          <Templates view={view} onPick={(key) => setTemplateKey(templateKey === key ? null : key)} />
          {slots.length > 0 ? <SlotFields slots={slots} text={text} onChange={(id, value) => setText({ ...text, [id]: value })} /> : null}
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={() => void record()} pending={phase === "recording" || phase === "saving"} disabled={view.recordable === null && templateKey === null}>
              {copy.RECORD_LABEL}
            </Button>
            {view.statusLine ? (
              <p role="status" className={HINT} data-testid="studio-status">
                {view.statusLine}
              </p>
            ) : null}
            {phase === "failed" && message ? (
              <Notice tone="warn" role="alert">
                {message}
              </Notice>
            ) : null}
            {file ? (
              <p className={HINT}>
                <a href={file.url} download="knitwright-video" className={CHIP} data-testid="studio-download">
                  {copy.DOWNLOAD_LABEL}
                </a>{" "}
                {file.note}
              </p>
            ) : null}
            {projectId ? null : <p className={HINT}>{copy.STUDIO_EMPTY.line}</p>}
          </div>
        </>
      )}
    </section>
  );
}

function Sequences({ view, onPick }: Readonly<{ view: StudioView; onPick: (key: SequenceKey) => void }>) {
  return (
    <fieldset className="flex flex-col gap-2" data-testid="studio-sequences">
      <legend className={H4}>Videos</legend>
      <ul className="flex flex-col gap-2">
        {view.sequences.map((card) => (
          <li key={card.key}>
            <SequenceRow card={card} onPick={onPick} />
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function SequenceRow({ card, onPick }: Readonly<{ card: SequenceCard; onPick: (key: SequenceKey) => void }>) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border px-3 py-2 ${card.selected ? CHOSEN : "border-white/10"}`}>
      <button
        type="button"
        aria-pressed={card.selected}
        disabled={!card.offered}
        onClick={() => onPick(card.key)}
        className="flex items-baseline justify-between gap-2 text-left disabled:opacity-55"
      >
        <span className="text-[13px] text-ink">{card.label}</span>
        <span className="text-[12px] text-ink-2">{card.seconds} s · free</span>
      </button>
      <p className={HINT}>{card.blocked ?? card.lead}</p>
    </div>
  );
}

function Templates({ view, onPick }: Readonly<{ view: StudioView; onPick: (key: string) => void }>) {
  return (
    <section aria-label={copy.TEMPLATES_HEADING} className="flex flex-col gap-2" data-testid="studio-templates">
      <h4 className={H4}>{copy.TEMPLATES_HEADING}</h4>
      <p className={HINT}>{copy.TEMPLATES_LEAD}</p>
      <ul className="flex flex-col gap-1.5">
        {view.templates.map((card) => (
          <li key={card.key}>
            <TemplateRow card={card} onPick={onPick} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TemplateRow({ card, onPick }: Readonly<{ card: TemplateCard; onPick: (key: string) => void }>) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border px-3 py-2 ${card.selected ? CHOSEN : "border-white/10"}`}>
      <button type="button" aria-pressed={card.selected} disabled={!card.ready} onClick={() => onPick(card.key)} className="flex items-baseline justify-between gap-2 text-left disabled:opacity-55">
        <span className="text-[13px] text-ink">{card.label}</span>
        <span className="text-[12px] text-ink-2">{card.seconds} s</span>
      </button>
      {card.waiting ? <p className={HINT}>{card.waiting}</p> : null}
    </div>
  );
}

type SlotProps = Readonly<{
  slots: readonly Readonly<{ id: string; label: string; limit: number }>[];
  text: Readonly<Record<string, string>>;
  onChange: (id: string, value: string) => void;
}>;

function SlotFields({ slots, text, onChange }: SlotProps) {
  const base = useId();
  return (
    <section aria-label="Text" className="flex flex-col gap-2" data-testid="studio-text">
      {slots.map((slot) => (
        <div key={slot.id} className="flex flex-col gap-1.5">
          <label htmlFor={`${base}-${slot.id}`} className={H4}>
            {slot.label}
          </label>
          <input
            id={`${base}-${slot.id}`}
            type="text"
            maxLength={slot.limit}
            value={text[slot.id] ?? ""}
            onChange={(event) => onChange(slot.id, event.target.value)}
            aria-describedby={`${base}-${slot.id}-hint`}
            className="min-h-10 w-full rounded-xl border border-white/15 bg-surface px-2 text-[13px] text-ink focus-visible:border-cobalt-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft"
          />
          <p id={`${base}-${slot.id}-hint`} className={HINT}>
            Up to {slot.limit} characters, burned into the picture.
          </p>
        </div>
      ))}
    </section>
  );
}
