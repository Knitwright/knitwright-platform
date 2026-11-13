"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { inspectorTarget, staleFocus } from "@/lib/inspector/selection";
import type { Graph, LaunchCommands } from "@/lib/launch";
import { useCanvas, useCanvasStore } from "../CanvasStore";
import { useInspectorFixture } from "./fixtures";
import { GarmentInspector } from "./GarmentInspector";
import { GroupInspector } from "./GroupInspector";
import { MockupInspector } from "./MockupInspector";

/**
 * THE RIGHT INSPECTOR BY SELECTION (plan v6 E3, decision 0147; `08` §5.3, e15–e26): reads the canvas
 * store's selection and draws the garment, element, mockup (and mockup edit mode) or group inspector.
 * For a selection none of those answer -- nothing, an AI board, a tech pack -- it draws nothing, and the
 * `fallback` it is given -- E2's project panel or the launch shell's board panels -- answers instead.
 *
 * E2's right panel (`components/editor-chrome/RightPanel.tsx`) hosts it, 310 px wide there
 * (`10` "Editor inspector (right)"), so the canvas is never narrowed.
 */

type Props = Readonly<{
  graph: Graph;
  canvasId: string;
  busy: boolean;
  commands: LaunchCommands;
  /** What the right panel shows when this inspector does not answer the selection (E2's panels). */
  fallback: ReactNode;
}>;

export function SelectionInspector({ graph, canvasId, busy, commands, fallback }: Props) {
  const store = useCanvasStore();
  const fixture = useInspectorFixture();
  const selection = useCanvas((state) => state.selection);
  const element = useCanvas((state) => state.element);
  const editing = useCanvas((state) => state.editing);

  // The fixture's opening selection, once (`/dev/inspector` only; a real canvas has no fixture).
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || fixture === null) return;
    opened.current = true;
    if (fixture.select) store.selectMany(fixture.select);
    if (fixture.editing) store.setEditing(fixture.editing);
  }, [fixture, store]);

  // A click elsewhere changes the selection; an element or an edit mode it no longer backs is finished.
  useEffect(() => {
    const stale = staleFocus({ selection, element, editing });
    if (stale.element) store.selectElement(null);
    if (stale.editing) store.setEditing(null);
  }, [selection, element, editing, store]);

  const target = inspectorTarget({ selection, boards: graph.boards, element, editing });
  if (target.kind === "none" || target.kind === "other") return <>{fallback}</>;

  const boardOf = (id: string) => graph.boards.find((board) => board.id === id);
  const body = (() => {
    switch (target.kind) {
      case "garment":
      case "element": {
        const board = boardOf(target.boardId);
        if (!board) return null;
        const elementId = target.kind === "element" ? target.elementId : (fixture?.elementId ?? null);
        return (
          <GarmentInspector
            key={board.id}
            board={board}
            designId={target.designId}
            canvasId={canvasId}
            busy={busy}
            commands={commands}
            elementId={elementId}
            onElement={(id) => store.selectElement(id === null ? null : { boardId: board.id, id })}
          />
        );
      }
      case "mockup": {
        const board = boardOf(target.boardId);
        return board ? <MockupInspector board={board} editing={target.editing} busy={busy} commands={commands} /> : null;
      }
      case "group":
        return <GroupInspector boards={target.boardIds.flatMap((id) => boardOf(id) ?? [])} busy={busy} commands={commands} />;
    }
  })();

  return (
    <section aria-label="Selection inspector" data-testid="selection-inspector" data-target={target.kind} className="flex min-h-0 flex-col">
      {body}
      {/* The board's own launch panel (L2's scene, crop and render for a mockup; the artboard and run for a
          garment) stays under E3's sections, so every door it had is still there. Not in edit mode, an
          element or a group, which are about something else. */}
      {target.kind === "garment" || (target.kind === "mockup" && !target.editing) ? <div className="border-t border-border">{fallback}</div> : null}
    </section>
  );
}
