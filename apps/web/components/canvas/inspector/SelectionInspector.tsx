"use client";

import { useEffect, useRef } from "react";
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
 * launch shell's inspector and E2's and E4's panels answer as before.
 *
 * It is its own component so E2's right-panel shell can host it wherever that panel lands; until then
 * `ProjectCanvas` mounts it beside the plane, 310 px wide (`10` "Editor inspector (right)").
 */

type Props = Readonly<{ graph: Graph; canvasId: string; busy: boolean; commands: LaunchCommands }>;

export function SelectionInspector({ graph, canvasId, busy, commands }: Props) {
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
  if (target.kind === "none" || target.kind === "other") return null;

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
    <aside
      aria-label="Selection inspector"
      data-testid="selection-inspector"
      data-target={target.kind}
      className="flex max-h-[60dvh] min-h-0 w-full shrink-0 flex-col overflow-y-auto rounded-3xl border border-border bg-bg shadow-e1 lg:max-h-none lg:w-77.5"
    >
      {body}
    </aside>
  );
}
