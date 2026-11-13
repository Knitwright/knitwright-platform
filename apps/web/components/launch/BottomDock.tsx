"use client";

import { Crown, Hash, MessageCircleMore, Minus, MousePointer2, PenTool, Plus, Redo2, Sparkle, Square, Type, Undo2, type LucideIcon } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { FloatingMenu, MENU_ROW } from "@/components/editor-chrome/FloatingMenu";
import { UpgradeButton } from "@/components/plans/UpgradeButton";
import { cx } from "@/components/ui/cx";
import { KwCoin } from "@/components/ui/Marks";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { zoomRows, type ZoomChoice } from "@/lib/editor-chrome";
import { DOCK_TOOLS, TOOLS, toolKeyTarget, type DockTool } from "@/lib/launch";

type Props = Readonly<{
  tool: DockTool;
  zoom: number;
  credits: number | null;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  hasSelection: boolean;
  onTool: (tool: DockTool) => void;
  onZoomStep: (direction: 1 | -1) => void;
  onZoomChoice: (choice: ZoomChoice) => void;
  onUndo: () => void;
  onRedo: () => void;
}>;

const ICONS: Readonly<Record<DockTool, LucideIcon>> = {
  select: MousePointer2,
  frame: Hash,
  shape: Square,
  pen: PenTool,
  text: Type,
  comment: MessageCircleMore,
  ai: Sparkle,
};

const KEYS: Readonly<Record<DockTool, string>> = { select: "V", frame: "F", shape: "R", pen: "P", text: "T", comment: "C", ai: "" };

const GROUP = "pointer-events-auto flex h-12.5 items-center gap-1 rounded-xl border border-border bg-bg px-1.5 shadow-e1";
const KEY = "grid h-9.5 w-9 place-items-center rounded-md text-text-2 hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Undo reaches what it says on the button: adding or removing a board, and a connector, are
 * changes to the canvas rather than to a board, and each has its own control (decision 0091).
 */
const UNDO_TITLE =
  "Undo covers a board's place, size, name and settings, and the project's unit and colours. Adding or removing a board, or a connector, is undone with its own control.";

/**
 * THE BOTTOM DOCK (`08` §5.1 "Bottom centre"; prototype e01 and e36; decision 0146): four groups.
 *
 *   1. the tools -- Select (V), Frame (F), Shape (R), Pen (P), Text (T), Comment (C), AI;
 *   2. Undo and Redo, then − zoom% +, where the per-cent opens the zoom menu (fits and 50/100/200%);
 *   3. the credit balance on the KW coin, which opens Get more credits;
 *   4. Upgrade, which opens the plans.
 *
 * Zoom goes through the canvas store (E1), so the dock, the keys and the wheel never disagree.
 */
export function BottomDock(props: Props) {
  const zoomId = useId();
  const zoomButton = useRef<HTMLButtonElement>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const tabs = useRef(new Map<DockTool, HTMLButtonElement>());

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = toolKeyTarget(props.tool, event.key);
    if (!target) return;
    event.preventDefault();
    props.onTool(target);
    tabs.current.get(target)?.focus();
  };

  return (
    <div className="flex items-center gap-2.5" data-testid="launch-dock">
      {/* A toolbar of pressed buttons rather than a tab list: these change what the canvas does,
          not which panel shows. The arrow keys move between them, as a toolbar's should. */}
      <div role="toolbar" aria-label="Tools" aria-orientation="horizontal" onKeyDown={move} className={GROUP} data-testid="launch-tools">
        {DOCK_TOOLS.map((id) => {
          const selected = id === props.tool;
          return (
            <button
              key={id}
              ref={(element) => {
                if (element) tabs.current.set(id, element);
                else tabs.current.delete(id);
              }}
              type="button"
              aria-pressed={selected}
              aria-label={TOOLS[id].label}
              aria-keyshortcuts={KEYS[id] || undefined}
              tabIndex={selected ? 0 : -1}
              title={`${TOOLS[id].label}${KEYS[id] ? ` (${KEYS[id]})` : ""}: ${TOOLS[id].hint}`}
              onClick={() => props.onTool(id)}
              className={cx(KEY, selected && "bg-border")}
            >
              <Icon icon={ICONS[id]} />
            </button>
          );
        })}
      </div>

      <div role="group" aria-label="History and zoom" className={GROUP}>
        <button type="button" aria-label="Undo" title={UNDO_TITLE} disabled={props.busy || !props.canUndo} onClick={props.onUndo} className={KEY} data-testid="launch-undo">
          <Icon icon={Undo2} />
        </button>
        <button type="button" aria-label="Redo" title={UNDO_TITLE} disabled={props.busy || !props.canRedo} onClick={props.onRedo} className={KEY} data-testid="launch-redo">
          <Icon icon={Redo2} />
        </button>
        <span aria-hidden="true" className="mx-1 h-7.5 w-px bg-border" />
        <button type="button" aria-label="Zoom out" onClick={() => props.onZoomStep(-1)} className={KEY} data-testid="zoom-out">
          <Icon icon={Minus} />
        </button>
        <span className="relative">
          <button
            ref={zoomButton}
            type="button"
            aria-label={`Zoom ${props.zoom}%, choose a zoom`}
            aria-haspopup="menu"
            aria-expanded={zoomOpen}
            aria-controls={zoomOpen ? zoomId : undefined}
            onClick={() => setZoomOpen(!zoomOpen)}
            className="h-9.5 w-14 rounded-md text-center text-body-lg font-medium text-text-2 hover:bg-soft"
            data-testid="zoom-percent"
          >
            {props.zoom}%
          </button>
          <FloatingMenu id={zoomId} label="Zoom" open={zoomOpen} onClose={() => setZoomOpen(false)} trigger={zoomButton} place="above" className="w-50">
            {zoomRows(props.hasSelection).map((row) => (
              <button
                key={row.id}
                type="button"
                role="menuitem"
                disabled={row.disabled}
                onClick={() => {
                  setZoomOpen(false);
                  zoomButton.current?.focus();
                  props.onZoomChoice(row.choice);
                }}
                className={MENU_ROW}
                data-testid={`zoom-${row.id}`}
              >
                {row.label}
              </button>
            ))}
          </FloatingMenu>
        </span>
        <button type="button" aria-label="Zoom in" onClick={() => props.onZoomStep(1)} className={KEY} data-testid="zoom-in">
          <Icon icon={Plus} />
        </button>
      </div>

      <div className={GROUP}>
        <Link href="/credits" title={props.credits === null ? "Credit balance not read" : `${props.credits} credits`} className={cx(KEY, "w-10")} data-testid="launch-credits">
          <KwCoin />
          <span className="sr-only">{props.credits === null ? "Credit balance not read" : `${props.credits} credits`}. Get more credits.</span>
        </Link>
      </div>

      <div className={GROUP}>
        <UpgradeButton kind="plans" className="flex h-9.5 items-center gap-2.5 rounded-md px-4 text-body-lg font-semibold text-text-2 hover:bg-soft">
          <Icon icon={Crown} className="fill-gold text-gold" />
          Upgrade
        </UpgradeButton>
      </div>
    </div>
  );
}
