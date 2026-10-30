"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { Route } from "next";
import { useRef, useState } from "react";
import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { LOADING_LABEL } from "@/lib/garment3d/viewer";
import { saveKitAction } from "@/lib/teamwear/actions";
import {
  configuratorHref,
  kitStateOf,
  handoffFor,
  handoffReference,
  IDEAS_UNAVAILABLE,
  parseView,
  QUOTE_UNAVAILABLE,
  snapshotName,
  SPORTS,
  studioHref,
  viewChips,
  withinFirstRenderBudget,
  type RailToolId,
  type StageViewId,
} from "@/lib/teamwear";
import { PanelSheet } from "./PanelSheet";
import { StageFrame } from "./StageFrame";
import { StickyFooter } from "./StickyFooter";
import { useConfigurator, type ConfiguratorInput } from "./useConfigurator";

// three.js and the drawing code are fetched with the stage, not with the page shell.
const KitStage = dynamic(() => import("./KitStage"), { ssr: false, loading: () => <p className="m-auto text-sm text-white/70">{LOADING_LABEL}</p> });

export type ConfiguratorProps = ConfiguratorInput &
  Readonly<{
    view: StageViewId;
    saved: Readonly<{ projectId: string; version: number }> | null;
    brandName: string;
  }>;

/**
 * The teamwear configurator of spec F-T1: a full-bleed 3D stage with a sport backdrop, the tool
 * rail and the view chip on it, the right panel with its kit-part pills and accordion, and the
 * sticky footer with the quantity, the tier price, the total and the three actions.
 *
 * Everything the person changes stays here until Save, which stores the part showing as a design and
 * is also what "Design in Studio" presses first, so the editor always opens a saved version.
 */
export function Configurator(props: ConfiguratorProps) {
  const state = useConfigurator(props);
  const { form, submit, pending, summary } = useFormAction(saveKitAction);
  const then = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<StageViewId>(props.view);
  const [turning, setTurning] = useState(false);
  const [snapshotAt, setSnapshotAt] = useState(0);
  const [tool, setTool] = useState<"ideas" | "add-element" | null>(null);
  const [quoteNote, setQuoteNote] = useState<string | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  const [renderNote, setRenderNote] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  /** Says where the person goes after the save, then sends the form. The field is read at submit, not at render. */
  const submitAs = (next: "stay" | "studio"): void => {
    if (then.current) then.current.value = next;
    form.current?.requestSubmit();
  };

  const kit = state.kit;
  const handoff = handoffFor(kit, props.saved, state.price);

  const press = (pressed: RailToolId): void => {
    if (pressed === "undo") return state.undo();
    if (pressed === "redo") return state.redo();
    if (pressed === "play") return setTurning((on) => !on);
    if (pressed === "snapshot") return setSnapshotAt(Date.now());
    if (pressed === "fullscreen") {
      void stage.current?.requestFullscreen?.().catch(() => undefined);
      return;
    }
    setTool((open) => (open === pressed ? null : (pressed as "ideas" | "add-element")));
  };

  const downloadSnapshot = (dataUrl: string): void => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = snapshotName(kit.sportId, view, new Date());
    link.click();
  };

  return (
    <div className="flex flex-col gap-3" data-testid="teamwear-configurator">
      <div className="flex flex-col gap-3 lg:grid lg:h-[calc(100dvh-14rem)] lg:grid-cols-[minmax(0,2fr)_22rem] lg:gap-4">
        <div className="flex min-h-0 flex-col gap-3">
        <nav aria-label="Sport" className="flex flex-wrap gap-2" data-testid="teamwear-sports">
          {SPORTS.map((sport) => (
            <Link
              key={sport.id}
              href={configuratorHref({ sportId: sport.id, part: "shirt", kit: kitStateOf(kit, state.part.id) }) as Route}
              aria-current={sport.id === kit.sportId ? "page" : undefined}
              className={`flex h-11 items-center rounded-full border px-4 text-[15px] no-underline ${sport.id === kit.sportId ? "border-white/40 bg-white/15 text-ink" : "border-white/15 text-muted"}`}
            >
              {sport.label}
            </Link>
          ))}
        </nav>

        <StageFrame
          ref={stage}
          views={viewChips(view)}
          onView={(next) => setView(parseView(next))}
          onTool={press}
          disabled={{ undo: !state.canUndo, redo: !state.canRedo }}
          pressed={{ play: turning, ideas: tool === "ideas", "add-element": tool === "add-element" }}
          tool={tool}
          toolNote={tool === "ideas" ? IDEAS_UNAVAILABLE : null}
          elements={state.rows}
          handlers={state.handlers}
          note={renderNote}
        >
          {state.preview.status === "drawn" ? (
            <KitStage
              flat={state.preview.flat}
              sportId={kit.sportId}
              view={view}
              turning={turning}
              snapshotAt={snapshotAt}
              onSnapshot={downloadSnapshot}
              onReady={(ms) => setRenderNote(withinFirstRenderBudget(ms) ? null : `The first picture took ${Math.round(ms)} ms, over the three-second budget.`)}
            />
          ) : (
            <p className="m-auto max-w-sm p-6 text-center text-sm text-white/80" data-testid="teamwear-stage-none">
              {state.preview.reason}
            </p>
          )}
        </StageFrame>
        </div>

        <PanelSheet title={`${state.part.label} · ${props.brandName}`} state={state} part={state.part.id} onPart={state.showPart} />
      </div>

      <form ref={form} action={submit} className="flex flex-col gap-2">
        <FormSummary message={summary} />
        <input type="hidden" name="sportId" value={kit.sportId} />
        <input type="hidden" name="part" value={state.part.id} />
        <input type="hidden" name="wearer" value={kit.wearer} />
        {/* A design name is at most eighty characters, and a brand's name can be long. */}
        <input type="hidden" name="name" value={`${props.brandName} ${state.part.label.toLowerCase()}`.slice(0, 80)} />
        <input type="hidden" name="main" value={kit.colours.main} />
        <input type="hidden" name="second" value={kit.colours.second} />
        <input type="hidden" name="third" value={kit.colours.third ?? ""} />
        <input type="hidden" name="socksColour" value={kit.socksColour} />
        <input type="hidden" name="quantity" value={state.choice.quantity} />
        <input ref={then} type="hidden" name="then" defaultValue="stay" />
        {Object.entries(state.choice.form.options).map(([group, code]) => (
          <input key={group} type="hidden" name="opt" value={`${group}:${code}`} />
        ))}
        {Object.entries(state.choice.form.parameters).map(([key, mm]) => (
          <input key={key} type="hidden" name="par" value={`${key}:${mm}`} />
        ))}
        <StickyFooter
          price={state.price}
          part={state.part.id}
          partLabel={state.part.label}
          quantity={state.choice.quantity}
          floor={state.floor}
          onQuantity={state.setQuantity}
          namesNumbers={kit.namesNumbers}
          studioHref={props.saved === null ? null : studioHref(props.saved.projectId, state.choice)}
          onSave={() => submitAs("stay")}
          onStudio={() => submitAs("studio")}
          saving={pending}
          onQuote={() => setQuoteNote(QUOTE_UNAVAILABLE)}
          quoteNote={quoteNote}
          onHandoff={() => setHandoffNote(handoff.ok ? `Give your Store contact this reference: ${handoffReference(handoff.handoff)}.` : handoff.reason)}
          handoffNote={handoffNote}
        />
      </form>
    </div>
  );
}
