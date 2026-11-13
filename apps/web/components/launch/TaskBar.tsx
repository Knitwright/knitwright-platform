"use client";

import { ArrowDownToLine, ChevronDown, Clapperboard, Copy, Ellipsis, ImagePlus, LayoutTemplate, Shirt, Sparkles, Table, FileText, ShoppingBag, type LucideIcon } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useCanvas } from "@/components/canvas/CanvasStore";
import { FloatingMenu, MENU_ROW } from "@/components/editor-chrome/FloatingMenu";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import type { Point, Rect } from "@/lib/canvas";
import { barPlace, entryKey, entryLabel, layOutBar, type BarEntry } from "@/lib/editor-chrome";
import type { BoardKind, TaskAction, TaskBar as TaskBarView } from "@/lib/launch";

type Props = Readonly<{
  bar: TaskBarView;
  busy: boolean;
  /** The selected board's box on the plane, which the bar floats above. */
  box: Rect;
  /** The stage the bar is drawn in, which holds the canvas. */
  stage: RefObject<HTMLElement | null>;
  onAdd: (kind: BoardKind) => void;
  onAction: (action: TaskAction) => void;
  /** The ⋯ button: the board's context menu, opened under this button. */
  onMenu: (at: Point) => void;
}>;

const KIND_ICONS: Partial<Record<BoardKind, LucideIcon>> = {
  ai_image: ImagePlus,
  ai_video: Clapperboard,
  mockup: Shirt,
  marketing: LayoutTemplate,
  info_card: Table,
  tech_pack: FileText,
  order: ShoppingBag,
};

const BUTTON = "inline-flex h-9.5 shrink-0 items-center gap-2 rounded-sm px-2.5 text-body-lg font-medium text-text-2 hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40";

/**
 * THE CONTEXTUAL TASK BAR (`08` §5.5; prototype e15 and e37; decision 0146): a white bar floating
 * above the selected board -- up to three named actions, "n more ▾" for the rest, then duplicate,
 * download and ⋯. What it offers is still `lib/launch/task-bar.ts`'s, laid out by
 * `lib/editor-chrome/task-bar.ts`. An item that is off keeps its place and says why in its title.
 */
export function TaskBar({ bar, busy, box, stage, onAdd, onAction, onMenu }: Props) {
  const moreId = useId();
  const element = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const viewport = useCanvas((state) => state.viewport);
  const screen = useCanvas((state) => state.screen);
  const laid = layOutBar(bar);

  // Placed after layout, by hand: the bar's own width and where the canvas sits in the stage are
  // only known once both are drawn, and a pan moves it every frame without a second render.
  useLayoutEffect(() => {
    const own = element.current;
    if (!own) return;
    const canvas = stage.current?.querySelector<HTMLElement>('[data-testid="flow-canvas"]');
    const outer = stage.current?.getBoundingClientRect();
    const inner = canvas?.getBoundingClientRect();
    const offset = outer && inner ? { x: inner.left - outer.left, y: inner.top - outer.top } : { x: 0, y: 0 };
    const place = barPlace(viewport, box, screen, own.offsetWidth);
    own.style.left = `${place.left + offset.x}px`;
    own.style.top = `${place.top + offset.y}px`;
  });

  const run = (entry: BarEntry) => (entry.kind === "add" ? onAdd(entry.add.kind) : onAction(entry.item.id));
  const off = (entry: BarEntry): boolean => busy || (entry.kind === "item" && entry.item.disabledReason !== null);
  const why = (entry: BarEntry): string | undefined => (entry.kind === "item" ? (entry.item.disabledReason ?? undefined) : entry.add.paid ? "Uses credits when it runs" : "Free");

  return (
    <div
      ref={element}
      role="toolbar"
      aria-label={`Actions for the ${bar.title}`}
      data-testid="launch-task-bar"
      className="pointer-events-auto absolute z-30 flex h-12.5 items-center gap-0.5 rounded-xl border border-border bg-bg px-2 whitespace-nowrap shadow-e2"
    >
      {laid.front.map((entry) => (
        <button key={entryKey(entry)} type="button" disabled={off(entry)} title={why(entry)} onClick={() => run(entry)} className={BUTTON} data-testid={testId(entry)}>
          <Icon icon={entry.kind === "add" ? (KIND_ICONS[entry.add.kind] ?? Sparkles) : Sparkles} />
          {entryLabel(entry)}
        </button>
      ))}
      {laid.moreLabel ? (
        <span className="relative">
          <button
            ref={moreButton}
            type="button"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-controls={moreOpen ? moreId : undefined}
            onClick={() => setMoreOpen(!moreOpen)}
            className={BUTTON}
            data-testid="task-more"
          >
            {laid.moreLabel}
            <Icon icon={ChevronDown} size={16} />
          </button>
          <FloatingMenu id={moreId} label="More actions" open={moreOpen} onClose={() => setMoreOpen(false)} trigger={moreButton} place="below" className="w-64">
            {laid.more.map((entry) => (
              <button
                key={entryKey(entry)}
                type="button"
                role="menuitem"
                disabled={off(entry)}
                title={why(entry)}
                onClick={() => {
                  setMoreOpen(false);
                  run(entry);
                }}
                className={MENU_ROW}
                data-testid={testId(entry)}
              >
                {entryLabel(entry)}
              </button>
            ))}
          </FloatingMenu>
        </span>
      ) : null}
      <span aria-hidden="true" className="mx-1.5 h-7 w-px bg-border" />
      {laid.duplicate ? <IconButton label="Duplicate" icon={Copy} disabled={busy} why={undefined} onClick={() => onAction("duplicate")} testId="task-duplicate" /> : null}
      {laid.download ? (
        <IconButton
          label="Download"
          icon={ArrowDownToLine}
          disabled={busy || laid.download.disabledReason !== null}
          why={laid.download.disabledReason ?? undefined}
          onClick={() => onAction("download")}
          testId="task-download"
        />
      ) : null}
      <button
        type="button"
        aria-label="More for this board"
        aria-haspopup="menu"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onMenu({ x: rect.left, y: rect.bottom + 8 });
        }}
        className={cx(BUTTON, "px-2")}
        data-testid="task-menu"
      >
        <Icon icon={Ellipsis} />
      </button>
    </div>
  );
}

const testId = (entry: BarEntry): string => (entry.kind === "add" ? `task-add-${entry.add.kind}` : `task-${entry.item.id}`);

function IconButton({ label, icon, disabled, why, onClick, testId: id }: Readonly<{ label: string; icon: LucideIcon; disabled: boolean; why: string | undefined; onClick: () => void; testId: string }>) {
  return (
    <button type="button" aria-label={label} title={why ?? label} disabled={disabled} onClick={onClick} className={cx(BUTTON, "px-2")} data-testid={id}>
      <Icon icon={icon} />
    </button>
  );
}
