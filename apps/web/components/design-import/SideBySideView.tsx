"use client";

import { useRef, useState } from "react";
import type { Handle, SideBySide, ViewDrawing } from "@/lib/design-import/side-by-side";
import { Button } from "@/components/ui/Button";

export type HandleMove = Readonly<{ view: ViewDrawing["view"]; id: Handle["id"]; side: Handle["side"]; x: number; y: number }>;

type Props = Readonly<{
  model: SideBySide;
  /** Where the person's picture is fetched from. */
  pictureUrl: string;
  busy: boolean;
  onMove: (move: HandleMove) => void;
  onAccept: (layerIds: readonly string[]) => void;
  onDiscard: () => void;
}>;

const ORIGIN_WORDS = { found: "Found in the picture", "model-guess": "A guess: check it", "moved-by-you": "Moved by you" } as const;

/** One view's outline and landmark handles over a picture-sized plane. Dragging a handle reports where it was dropped. */
function Overlay({ drawing, picture, onMove }: Readonly<{ drawing: ViewDrawing; picture: SideBySide["picture"]; onMove: Props["onMove"] }>) {
  const svg = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ index: number; x: number; y: number } | null>(null);
  const place = (event: React.PointerEvent): { x: number; y: number } => {
    const box = svg.current?.getBoundingClientRect();
    if (!box || box.width === 0) return { x: 0, y: 0 };
    return { x: ((event.clientX - box.left) / box.width) * picture.width, y: ((event.clientY - box.top) / box.height) * picture.height };
  };
  const drop = (event: React.PointerEvent): void => {
    if (!dragging) return;
    const handle = drawing.handles[dragging.index];
    const at = place(event);
    setDragging(null);
    onMove({ view: drawing.view, id: handle.id, side: handle.side, x: Math.round(at.x), y: Math.round(at.y) });
  };
  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${picture.width} ${picture.height}`}
      className="absolute inset-0 size-full touch-none"
      onPointerMove={(event) => dragging && setDragging({ ...dragging, ...place(event) })}
      onPointerUp={drop}
      role="group"
      aria-label={`Outline and landmarks of the ${drawing.view}`}
    >
      <polygon points={drawing.outline} fill="none" stroke="#38bdf8" strokeWidth={2} />
      {drawing.handles.map((handle, index) => {
        const at = dragging?.index === index ? dragging : handle;
        return (
          <circle
            key={`${handle.id}-${handle.side}`}
            cx={at.x}
            cy={at.y}
            r={7}
            fill={handle.origin === "moved-by-you" ? "#22c55e" : handle.origin === "model-guess" ? "#f59e0b" : "#38bdf8"}
            stroke="#0b1220"
            strokeWidth={2}
            className="cursor-grab"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging({ index, x: handle.x, y: handle.y });
            }}
          >
            <title>{`${handle.label}. ${ORIGIN_WORDS[handle.origin]}. ${handle.confidenceText}.`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

/** Our drawing of the proposed design: each view's outline filled with the main colour. */
function Drawing({ drawing, picture }: Readonly<{ drawing: ViewDrawing; picture: SideBySide["picture"] }>) {
  return (
    <svg viewBox={`0 0 ${picture.width} ${picture.height}`} className="absolute inset-0 size-full" role="img" aria-label={`Our drawing of the ${drawing.view}`}>
      <polygon points={drawing.outline} fill={drawing.ground} stroke="#94a3b8" strokeWidth={1.5} />
    </svg>
  );
}

/** The user's picture on the left, our drawing on the right, and what was found beneath: nothing is saved until Accept. */
export function SideBySideView({ model, pictureUrl, busy, onMove, onAccept, onDiscard }: Props) {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set(model.layers.map((layer) => layer.id)));
  const toggle = (id: string): void => setChosen((now) => (now.has(id) ? new Set([...now].filter((x) => x !== id)) : new Set([...now, id])));
  const frame = { aspectRatio: `${model.picture.width} / ${model.picture.height}` };
  return (
    <section aria-labelledby="close-reading-heading" data-testid="side-by-side" className="flex flex-col gap-4">
      <h3 id="close-reading-heading" className="text-[15px] font-medium text-ink">{model.heading}</h3>
      <p className="text-[13px] text-chalk-muted">Nothing is saved to your design until you accept it.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <figure className="flex flex-col gap-1">
          <div className="relative w-full overflow-hidden rounded-xl border border-white/15" style={frame}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the person's own picture, served by the files route */}
            <img src={pictureUrl} alt="Your picture" className="absolute inset-0 size-full object-contain" />
            {model.views.map((drawing) => (
              <Overlay key={drawing.view} drawing={drawing} picture={model.picture} onMove={onMove} />
            ))}
          </div>
          <figcaption className="text-[12px] text-chalk-muted">Your picture, with the outline and landmarks we found. Drag a dot to move it.</figcaption>
        </figure>
        <figure className="flex flex-col gap-1">
          <div className="relative w-full overflow-hidden rounded-xl border border-white/15 bg-white/[0.03]" style={frame}>
            {model.views.map((drawing) => (
              <Drawing key={drawing.view} drawing={drawing} picture={model.picture} />
            ))}
          </div>
          <figcaption className="text-[12px] text-chalk-muted">Our drawing of the design as read.</figcaption>
        </figure>
      </div>
      <ul className="flex flex-col gap-2" aria-label="Layers">
        {model.layers.map((layer) => (
          <li key={layer.id} className="text-[13px] leading-relaxed text-chalk-muted">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={chosen.has(layer.id)} onChange={() => toggle(layer.id)} className="mt-1" />
              <span>
                <span className="text-ink">{layer.label}</span>: {layer.confidenceText}. {layer.note}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap gap-2" aria-label="Colours read">
        {model.colours.map((colour) => (
          <li key={colour.id} className="flex items-center gap-2 text-[13px] text-chalk-muted">
            <span className="size-5 rounded-full border border-white/30" style={{ backgroundColor: colour.hex }} aria-hidden="true" />
            {colour.role}, screen colour {colour.hex}
          </li>
        ))}
      </ul>
      {model.missing.length > 0 ? (
        <ul className="flex flex-col gap-1" aria-label="Left empty">
          {model.missing.map((entry) => (
            <li key={`${entry.view}-${entry.note}`} className="text-[13px] text-chalk-muted">{entry.note}</li>
          ))}
        </ul>
      ) : null}
      {model.warnings.map((warning) => (
        <p key={warning} className="text-[13px] text-chalk-muted">{warning}</p>
      ))}
      <p className="text-[12px] text-chalk-muted">{model.fittedTo}</p>
      <div>
        <h4 className="text-[13px] font-medium text-ink">What a picture can and cannot give us</h4>
        <ul className="mt-1 list-disc pl-5 text-[12px] leading-relaxed text-chalk-muted">
          {[...model.limits, ...model.notReadYet].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" pending={busy} disabled={busy || chosen.size === 0} onClick={() => onAccept([...chosen])}>
          Accept the layers ticked
        </Button>
        <Button variant="quiet" disabled={busy} onClick={onDiscard}>
          Discard this reading
        </Button>
      </div>
    </section>
  );
}
