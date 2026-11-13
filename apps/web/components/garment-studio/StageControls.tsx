"use client";

import { Columns2, FileText, Image as ImageIcon, Ruler, RotateCw, Shirt, UserRound } from "lucide-react";
import { useId } from "react";
import { ValidateChip } from "@/components/studio/editor/ValidateChip";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import type { CanvasView, FindingLine, SimulateChip } from "@/lib/editor";
import { CANVAS_VIEWS, VIEWS, showing } from "@/lib/editor";
import type { FitChip } from "@/lib/garment-studio/fit";
import { PillMenu, type PillChoice } from "./PillMenu";

/**
 * THE STAGE'S CONTROLS (plan v6 G1, decision 0150; `08` v3.6 and v3.7, s02, s17, s18).
 *
 * Bottom left, the colourway and size pills with their menus; bottom centre, 2D / 3D / Tech pack
 * (shift-press, or "Side by side", shows two at once, as the editor always could); top right, "Fit
 * checked" with what the checks found, and the turntable (Simulate), picture and avatar buttons.
 * The avatar is Fabra's fit-on-your-own-body: not built, so it says so and does nothing.
 */

type BarProps = Readonly<{
  colourways: readonly PillChoice[];
  colourwayId: string;
  onColourway: (id: string) => void;
  onNewColourway: () => void;
  sizes: readonly string[];
  size: string;
  onSize: (size: string) => void;
  view: CanvasView;
  beside: CanvasView | null;
  onView: (view: CanvasView, alongside: boolean) => void;
  busy: boolean;
}>;

export function StageBar(props: BarProps) {
  const chosen = props.colourways.find((choice) => choice.id === props.colourwayId);
  return (
    <div className="flex flex-wrap items-center gap-2 py-4" data-testid="canvas-bottom-bar">
      <PillMenu
        label="Kit colourway"
        icon={<Icon icon={Shirt} size={20} />}
        value={chosen?.label ?? props.colourwayId}
        choices={props.colourways}
        chosen={props.colourwayId}
        onChoose={props.onColourway}
        extra={{ label: "New colourway", testId: "new-colourway", disabled: props.busy, onSelect: props.onNewColourway }}
        testId="colourway-pill"
      />
      {props.sizes.length > 0 ? (
        <PillMenu
          label="Size shown"
          icon={<Icon icon={Ruler} size={20} />}
          value={`Size ${props.size}`}
          choices={props.sizes.map((size) => ({ id: size, label: `Size ${size}` }))}
          chosen={props.size}
          onChoose={props.onSize}
          testId="size-shown"
        />
      ) : null}
      <ViewSwitch view={props.view} beside={props.beside} onView={props.onView} />
    </div>
  );
}

const VIEW_ICON: Partial<Record<CanvasView, typeof FileText>> = { "tech-pack": FileText };

function ViewSwitch({ view, beside, onView }: Readonly<{ view: CanvasView; beside: CanvasView | null; onView: BarProps["onView"] }>) {
  const sideId = useId();
  return (
    <div className="ml-auto flex items-center gap-2">
      <div role="group" aria-label="Canvas views" className="flex h-12 items-center gap-1 rounded-lg border border-border bg-bg p-1 shadow-e1" data-testid="view-toggle">
        {CANVAS_VIEWS.map((id) => {
          const on = showing(view, beside, id);
          const glyph = VIEW_ICON[id];
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              title={VIEWS[id].label}
              onClick={(event) => onView(id, event.shiftKey)}
              className={cx("inline-flex h-10 min-w-10 items-center justify-center rounded-md px-2.5 text-body font-semibold", on ? "bg-soft text-text" : "text-text-2 live:hover:bg-soft")}
            >
              {glyph ? (
                <>
                  <Icon icon={glyph} size={20} />
                  <span className="sr-only">{VIEWS[id].label}</span>
                </>
              ) : (
                VIEWS[id].label
              )}
            </button>
          );
        })}
        {/* Two views at once, as the editor always offered: a box and a glyph, to keep the bar on one line. */}
        <label htmlFor={sideId} className="inline-flex h-10 items-center gap-1 border-l border-border pr-1 pl-2 text-text-2" title="Side by side">
          <input
            id={sideId}
            type="checkbox"
            checked={beside !== null}
            onChange={(event) => (event.target.checked ? onView(partner(view), true) : onView(view, false))}
            className="size-4 accent-navy"
          />
          <Icon icon={Columns2} size={16} />
          <span className="sr-only">Side by side</span>
        </label>
      </div>
    </div>
  );
}

/** The view that joins the one shown when side by side is turned on: the next one along. */
const partner = (view: CanvasView): CanvasView => CANVAS_VIEWS[(CANVAS_VIEWS.indexOf(view) + 1) % CANVAS_VIEWS.length] as CanvasView;

type TopProps = Readonly<{
  fit: FitChip;
  findings: readonly FindingLine[];
  simulate: SimulateChip;
  onSimulate: () => void;
  onPhotoreal: () => void;
}>;

const FIT_TONES: Readonly<Record<FitChip["tone"], string>> = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  neutral: "text-text-2",
};

/** Top right of the stage: Fit checked, then the turntable, picture and avatar buttons. */
export function StageTop({ fit, findings, simulate, onSimulate, onPhotoreal }: TopProps) {
  return (
    <div className="flex items-center gap-2" data-testid="stage-top">
      <div className={cx("rounded-lg bg-bg shadow-e1", FIT_TONES[fit.tone])} data-testid="fit-checked" data-tone={fit.tone}>
        <ValidateChip chip={fit.chip} findings={findings} />
      </div>
      <div className="flex h-12 items-center gap-0.5 rounded-lg bg-bg px-1 shadow-e1">
        <Button variant="ghost" iconOnly aria-label="Simulate" title="Simulate: build the 3D model again" icon={<Icon icon={RotateCw} size={20} />} disabled={!simulate.canSimulate} onClick={onSimulate} data-testid="simulate" />
        <Button variant="ghost" iconOnly aria-label="Photoreal picture" title="Photoreal picture" icon={<Icon icon={ImageIcon} size={20} />} onClick={onPhotoreal} />
        <Button variant="ghost" iconOnly aria-label="Fit on a player" icon={<Icon icon={UserRound} size={20} />} disabledReason="Fit on your own player measurements is coming soon." />
      </div>
      <span role="status" className="sr-only" data-testid="simulate-chip">
        {simulate.label}
      </span>
    </div>
  );
}
