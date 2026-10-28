"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import type { ArtworkStack } from "@/lib/artwork-stack";
import type { Panel } from "@/lib/guardrails";
import type { AssetFacts } from "@/lib/panel-layers/guardrail-input";
import { viewBoxOf } from "@/lib/panel-layers/labels";
import { ChecksList } from "./ChecksList";
import { LayerList } from "./LayerList";
import { usePanelLayers } from "./usePanelLayers";

// Fabric.js is fetched only when this prototype opens. It is never part of the design editor's bundle.
const PanelCanvas = dynamic(() => import("./PanelCanvas"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted">Loading the canvas.</p>,
});

const CANVAS_WIDTH_PX = 480;
const MARGIN_MM = 30;

type PanelLayersEditorProps = Readonly<{
  projectId: string;
  designName: string;
  version: number;
  stack: ArtworkStack;
  panel: Panel;
  facts: AssetFacts;
  /** Says where the outline comes from. */
  panelNote: string;
}>;

/** A prototype (decision 0053): one panel of a design edited as layers on a Fabric.js canvas. Not linked from anywhere. */
export function PanelLayersEditor({ designName, panelNote, ...input }: PanelLayersEditorProps) {
  const state = usePanelLayers(input);
  const view = viewBoxOf(state.frame, MARGIN_MM);
  const outline = input.panel.cutOutline.map(([x, y]) => `${x},${y}`).join(" ");
  const sewn = input.panel.sewLine?.map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <div data-testid="panel-layers" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium text-ink">Panel layers (prototype)</h1>
        <p className="text-sm text-muted">
          {designName}, front panel. A trial of a layer editor. The design editor is unchanged. {panelNote}
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <div className="relative rounded-lg border border-white/15" style={{ width: CANVAS_WIDTH_PX, aspectRatio: `${view.w} / ${view.h}` }}>
          <PanelCanvas
            doc={state.canvasDoc}
            view={view}
            widthPx={CANVAS_WIDTH_PX}
            onLive={state.live}
            onCommit={state.commit}
            onSelect={state.select}
            selectedId={state.selectedId}
          />
          <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} role="img" aria-label="Outline of the panel" className="pointer-events-none absolute inset-0 size-full">
            <polygon points={outline} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-white/60" />
            {sewn ? <polygon points={sewn} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="6 4" className="text-white/40" /> : null}
          </svg>
        </div>
        <div className="flex flex-col gap-6">
          <LayerList layers={state.viewLayers} selectedId={state.selectedId} onSelect={state.select} onMove={state.move} onRemove={state.remove} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={state.addText}>
              Add text
            </Button>
            <Button type="button" pending={state.saving} disabled={!state.dirty || state.saving} onClick={() => void state.save()}>
              Save as a new version
            </Button>
            <p role="status" data-testid="save-status" className="text-sm text-muted">
              {state.message ?? (state.dirty ? "Changes are not saved." : `Version ${state.version} is open.`)}
            </p>
          </div>
          <ChecksList findings={state.findings} />
        </div>
      </div>
    </div>
  );
}
