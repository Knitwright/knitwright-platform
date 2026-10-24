"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { WorkspaceLayout } from "@/lib/workspace/layout";
import { DiffPanel } from "../assistant/DiffPanel";
import { ChatPanel } from "../ChatPanel";
import type { AssistantInfo } from "../Editor";
import { XL, useMedia } from "./useMedia";

type DockProps = Readonly<{
  projectId: string;
  version: number;
  busy: boolean;
  assistant: AssistantInfo;
  layout: WorkspaceLayout;
  /** Shown above the conversation: a question for the person, such as who the design is for. */
  above: ReactNode;
  onToggleDock: () => void;
  onCloseSheet: () => void;
}>;

const SMALL_BUTTON =
  "chip-btn h-9 items-center rounded-full border border-white/20 px-3.5 text-sm font-medium text-ink";

/** Where the assistant sits: docked on the right of a wide screen, or a sheet over a narrow one. */
const placement = ({ dockOpen, sheetOpen }: WorkspaceLayout): string => {
  const narrow = sheetOpen
    ? "fixed inset-x-2 top-3 bottom-2 z-50 flex border border-white/15 bg-surface-solid shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] lg:left-auto lg:right-4 lg:top-24 lg:bottom-4 lg:w-[24rem]"
    : "hidden";
  const wide = dockOpen ? "xl:glass xl:static xl:z-auto xl:flex xl:w-auto" : "xl:hidden";
  return `${narrow} ${wide}`;
};

/**
 * The design assistant with its kept conversation and one-tap answers. On a wide screen it is
 * docked on the right and can be collapsed; on a narrower one it opens as a sheet, closed with
 * the Close button or Escape. Collapsed or closed, it is only hidden, so the conversation stays.
 */
export function AssistantDock({ projectId, version, busy, assistant, layout, above, onToggleDock, onCloseSheet }: DockProps) {
  const title = useRef<HTMLHeadingElement>(null);
  const docked = useMedia(XL);
  useEffect(() => {
    if (layout.sheetOpen) title.current?.focus();
  }, [layout.sheetOpen]);

  const escape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && layout.sheetOpen) {
      event.stopPropagation();
      onCloseSheet();
    }
  };

  const panel = (
    <aside
      id="assistant-panel"
      aria-labelledby="assistant-title"
      role={layout.sheetOpen && !docked ? "dialog" : undefined}
      onKeyDown={escape}
      className={`min-h-0 flex-col gap-3 overflow-hidden rounded-3xl p-4 ${placement(layout)}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="size-7 flex-none rounded-full bg-[linear-gradient(135deg,#b9c4ff,#ffd3e6_50%,#c7f0e4)]" aria-hidden="true" />
        <h2 id="assistant-title" ref={title} tabIndex={-1} className="flex-1 text-[15px] font-medium text-ink outline-none">
          Design assistant
        </h2>
        <button type="button" onClick={onToggleDock} aria-expanded={layout.dockOpen} className={`${SMALL_BUTTON} hidden xl:inline-flex`}>
          Hide
        </button>
        <button type="button" onClick={onCloseSheet} className={`${SMALL_BUTTON} inline-flex xl:hidden`}>
          Close
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
        {above}
        <ChatPanel projectId={projectId} version={version} available={assistant.available} busy={busy} conversation={assistant.conversation} />
        <DiffPanel projectId={projectId} version={version} busy={busy} />
      </div>
    </aside>
  );

  // Not docked, the sheet is fixed over the screen. The page rises into place with a transform,
  // which would pin it to the page instead, so it is drawn at the end of the body.
  if (!docked) return createPortal(panel, document.body);
  return (
    <>
      {layout.dockOpen ? null : (
        <div className="glass flex min-h-0 flex-col items-center rounded-3xl p-2">
          <button
            type="button"
            onClick={onToggleDock}
            aria-expanded={false}
            aria-controls="assistant-panel"
            className="flex flex-col items-center gap-2 rounded-2xl px-1 py-2 text-[11px] text-ink-2 hover:text-ink"
          >
            <span className="size-8 rounded-full bg-[linear-gradient(135deg,#b9c4ff,#ffd3e6_50%,#c7f0e4)]" aria-hidden="true" />
            Show assistant
          </button>
        </div>
      )}
      {panel}
    </>
  );
}
