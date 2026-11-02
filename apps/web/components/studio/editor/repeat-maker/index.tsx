"use client";

import { useState } from "react";
import { ArtworkUpload } from "@/components/artwork/ArtworkUpload";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { EditorSlotProps } from "@/lib/editor/slots";
import {
  DRAWN_SHAPES,
  DRAWN_SHAPE_LABELS,
  REPEAT_STYLES,
  REPEAT_STYLE_LABELS,
  REPEAT_STYLE_NOTES,
  TILE_UNITS,
  TILE_UNIT_LABELS,
  type DrawnShape,
  type RepeatDraft,
} from "@/lib/repeat";
import { WhyButton } from "../WhyButton";
import { browserDeps, publishRepeat } from "./publish";
import {
  addLayer,
  changeLayer,
  layerFromShape,
  layerFromUpload,
  removeLayer,
  reorderLayer,
  repeatView,
  setBackground,
  startDraft,
  typeSide,
  withUnit,
} from "./state";
import { TilePreview } from "./TilePreview";

/**
 * The repeat / pattern-fill maker (spec F-S4, plan v5 Y8, decision 0081). A slot panel: it is given
 * the design and the shell's commands and nothing else, and it fetches nothing.
 *
 * Upload a picture or draw a shape, set the tile in centimetres or inches, pick Full drop,
 * Half-drop, Brick or Mirror, move the layers inside the tile's bounds, choose the background, and
 * publish the tile to Your library. An upload goes through the ordinary artwork upload, so it is
 * screened before it is stored (F-G1).
 */
export default function RepeatMaker({ design }: EditorSlotProps) {
  const [draft, setDraft] = useState<RepeatDraft>(() => startDraft(design.article?.name ?? "Design"));
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const view = repeatView(draft);

  const change = (next: RepeatDraft) => {
    setDraft(next);
    setProblem(null);
    setDone(null);
  };

  const side = (which: "width" | "height", text: string) => {
    const read = typeSide(draft, which, text);
    if (read.ok) change(read.draft);
    else setProblem(read.reason);
  };

  const draw = (shape: DrawnShape) => change(addLayer(draft, layerFromShape(draft, shape, "#1b2a49", draft.layers.length + 1)));

  const publish = async () => {
    setBusy(true);
    setProblem(null);
    const outcome = await publishRepeat(browserDeps(new Map()), draft);
    setBusy(false);
    if (outcome.ok) setDone(`Published as ${outcome.artwork.label}. You will find it under Your library.`);
    else setProblem(outcome.reason);
  };

  return (
    <section aria-label="Repeat maker" data-testid="repeat-maker-panel" className="glass flex flex-col gap-5 rounded-2xl p-5">
      <header className="flex flex-col gap-1">
        <h3 className="font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">Repeat maker</h3>
        <p className="text-[13px] text-chalk-muted">Build one tile. The repeat lays it out, and the whole thing prints in one pass.</p>
      </header>

      <TilePreview view={view.preview} crossing={view.crossing} />
      <p className="text-[13px] text-chalk-muted" data-testid="repeat-period">
        {view.periodSentence}
      </p>

      <div className="flex flex-col gap-2" data-testid="repeat-styles">
        <h4 className="text-[13px] font-medium text-ink">Repeat style</h4>
        <ul className="grid gap-2 sm:grid-cols-2">
          {REPEAT_STYLES.map((style) => (
            <li key={style}>
              <button
                type="button"
                aria-pressed={draft.style === style}
                onClick={() => change({ ...draft, style })}
                data-testid={`repeat-style-${style}`}
                className={`flex min-h-16 w-full flex-col items-start justify-center gap-0.5 rounded-xl border p-3 text-left ${
                  draft.style === style ? "border-white/40 bg-tile-2" : "border-white/10 hover:bg-tile-2/60"
                }`}
              >
                <span className="text-[13px] text-ink">{REPEAT_STYLE_LABELS[style]}</span>
                <span className="text-[11px] text-chalk-muted">{REPEAT_STYLE_NOTES[style]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2" data-testid="repeat-tile-size">
        <h4 className="text-[13px] font-medium text-ink">Tile size</h4>
        <div className="flex flex-wrap items-end gap-2">
          {TILE_UNITS.map((unit) => (
            <button
              key={unit}
              type="button"
              aria-pressed={draft.unit === unit}
              onClick={() => change(withUnit(draft, unit))}
              data-testid={`repeat-unit-${unit}`}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-[13px] ${draft.unit === unit ? "border-white/40 bg-tile-2 text-ink" : "border-white/10 text-chalk-muted"}`}
            >
              {TILE_UNIT_LABELS[unit]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Field name="tileWidth" label={`Width (${draft.unit})`} inputMode="decimal" value={view.widthText} onChange={(event) => side("width", event.currentTarget.value)} />
          <Field name="tileHeight" label={`Height (${draft.unit})`} inputMode="decimal" value={view.heightText} onChange={(event) => side("height", event.currentTarget.value)} />
        </div>
        <p className="text-[11px] text-chalk-muted">{view.rangeSentence}</p>
        <label className="flex min-h-10 items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" checked={draft.wrap} onChange={(event) => change({ ...draft, wrap: event.currentTarget.checked })} className="size-4" />
          Join at the edges, so the repeat has no seam
        </label>
      </div>

      <div className="flex flex-col gap-2" data-testid="repeat-background">
        <h4 className="text-[13px] font-medium text-ink">Background</h4>
        <Field name="background" label="Behind every layer" type="color" value={draft.background} onChange={(event) => change(setBackground(draft, event.currentTarget.value))} />
      </div>

      <div className="flex flex-col gap-3" data-testid="repeat-add">
        <h4 className="text-[13px] font-medium text-ink">Add to the tile</h4>
        <ArtworkUpload onUploaded={(artwork) => change(addLayer(draft, layerFromUpload(draft, artwork)))} />
        <div className="flex flex-wrap gap-2">
          {DRAWN_SHAPES.map((shape) => (
            <Button key={shape} type="button" variant="secondary" onClick={() => draw(shape)}>
              Draw a {DRAWN_SHAPE_LABELS[shape].toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2" data-testid="repeat-layers">
        <h4 className="text-[13px] font-medium text-ink">Layers</h4>
        {draft.layers.length === 0 ? (
          <p className="text-[13px] text-chalk-muted">Nothing on the tile yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...draft.layers].reverse().map((layer) => (
              <li key={layer.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 p-3" data-testid={`repeat-layer-${layer.id}`}>
                <span className="flex-1 truncate text-[13px] text-ink">{layer.label}</span>
                {view.crossing.includes(layer.id) ? <span className="text-[11px] text-warn">Crosses the tile edge</span> : null}
                {layer.artworkId === null ? (
                  <input
                    type="color"
                    aria-label={`Colour of ${layer.label}`}
                    value={layer.colour}
                    onChange={(event) => change(changeLayer(draft, layer.id, { colour: event.currentTarget.value }))}
                    className="h-10 w-12 rounded-lg border border-white/10 bg-transparent"
                  />
                ) : null}
                <Button type="button" variant="secondary" onClick={() => change(reorderLayer(draft, layer.id, 1))} aria-label={`Bring ${layer.label} forward`}>
                  Forward
                </Button>
                <Button type="button" variant="secondary" onClick={() => change(reorderLayer(draft, layer.id, -1))} aria-label={`Send ${layer.label} back`}>
                  Back
                </Button>
                <Button type="button" variant="secondary" onClick={() => change(removeLayer(draft, layer.id))} aria-label={`Take ${layer.label} off the tile`}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {view.findings.length > 0 ? (
        <ul className="flex flex-col gap-2" data-testid="repeat-findings">
          {view.findings.map((finding) => (
            <li key={`${finding.code}-${finding.layerId ?? "tile"}`} className="flex flex-wrap items-center gap-1 rounded-lg bg-warn-wash px-3 py-2 text-[13px] text-warn">
              <span>
                {finding.message} {finding.action}
              </span>
              {finding.ruleId === "R-GAP-000" ? null : <WhyButton ruleId={finding.ruleId} context={`repeat ${finding.code}`} />}
            </li>
          ))}
        </ul>
      ) : null}

      {problem ? (
        <p role="alert" className="rounded-lg bg-warn-wash px-3 py-2 text-[13px] text-warn" data-testid="repeat-problem">
          {problem}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="rounded-lg bg-ok-wash px-3 py-2 text-[13px] text-ok" data-testid="repeat-published">
          {done}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Field name="name" label="Name" value={draft.name} onChange={(event) => change({ ...draft, name: event.currentTarget.value })} />
        <Button type="button" pending={busy} disabled={view.blocked || busy} onClick={() => void publish()}>
          {busy ? "Publishing" : "Publish to Your library"}
        </Button>
      </div>
    </section>
  );
}
