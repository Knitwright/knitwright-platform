"use client";

import { Clapperboard, ScanSearch } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { SceneThumb } from "@/components/mockups/SceneThumb";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Inputs";
import { Notice } from "@/components/ui/Notice";
import { boxOf } from "@/lib/canvas";
import type { BoardView, LaunchCommands } from "@/lib/launch";
import {
  KIT_ROLE_LABELS,
  KIT_ROLES,
  PLACEMENT_FIXED,
  SCENE_GROUP_LABELS,
  rosterLabel,
  sceneBySlug,
  sceneSlugOf,
  settingsFrom,
  settingsToStored,
  type KitRole,
  type MockupScene,
} from "@/lib/mockups";
import { useCanvas, useCanvasStore } from "../CanvasStore";
import { Row, Section, ToolButton } from "./parts";

/**
 * THE MOCKUP INSPECTOR AND MOCKUP EDIT MODE (plan v6 E3, decision 0147; `08` §5.3 "Mockup board",
 * v3.6 "Mockup edit mode", e16, e26).
 *
 * Selected: the scene (thumb, name, collection), the kit the shirt wears, the roster player, and Tools.
 * Double-click the board (or press **Edit mockup**) for edit mode: the print area shows as a blue box
 * inside the mockup, the task bar hides, and the panel shows the mockup and how its print sits. Click
 * outside, press Esc or **Done** to finish.
 *
 * **The box is shown, not dragged.** F-L1: "Placement inside a photo scene is fixed by the scene's
 * garment slot ... Users cannot drag the print area." Where the prototype says "drag or resize the blue
 * box", `02` wins (decision 0131: behaviour comes from `02`), so edit mode shows the slot and says so.
 * Every change here is the board's own `setBoardSettings`, as L2's panel makes it.
 */

const sceneOf = (board: BoardView): MockupScene | null => sceneBySlug(sceneSlugOf(board.settings) ?? "");

export function MockupInspector({ board, editing, busy, commands }: Readonly<{ board: BoardView; editing: boolean; busy: boolean; commands: LaunchCommands }>) {
  const store = useCanvasStore();
  const scene = sceneOf(board);

  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") store.setEditing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, store]);

  if (scene === null) {
    return (
      <div className="flex flex-col gap-3 p-4" data-testid="mockup-inspector">
        <Notice tone="info">This mockup board has no scene yet. Choose one in the board&apos;s panel or the Mockups panel.</Notice>
      </div>
    );
  }
  const settings = settingsFrom(board.settings, scene);
  const setKit = (kitRole: KitRole): void => commands.setBoardSettings(board.id, settingsToStored({ ...settings, kitRole }));
  const head = (
    <Section title="Mockup">
      <div className="flex items-center gap-3">
        <div className="w-16 shrink-0 overflow-hidden rounded-md">
          <SceneThumb scene={scene} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-body-lg font-semibold text-text">{scene.title}</p>
          <p className="truncate text-small text-muted">{SCENE_GROUP_LABELS[scene.group]}</p>
        </div>
      </div>
    </Section>
  );

  if (editing) {
    return (
      <div className="flex flex-col" data-testid="mockup-edit-inspector">
        {head}
        <Section title="Print area">
          <p className="text-small text-muted">{PLACEMENT_FIXED}</p>
          <Row label="Slots">{String(scene.slots.length)}</Row>
        </Section>
        <Section title="Mockup colour">
          <Row label="Backdrop">{scene.backdrop.label}</Row>
        </Section>
        <div className="flex flex-col gap-2 p-4">
          <p className="text-caption text-muted">Editing the print inside the mockup. The garment stays locked. Click outside, or press Esc, to finish.</p>
          <Button variant="primary" onClick={() => store.setEditing(null)} data-testid="mockup-edit-done">
            Done
          </Button>
        </div>
      </div>
    );
  }

  const box = boxOf(board);
  return (
    <div className="flex flex-col" data-testid="mockup-inspector">
      {head}
      <Section title="Colourway">
        <Select aria-label="Kit the shirt wears" value={settings.kitRole} disabled={busy} onChange={(event) => setKit(event.target.value as KitRole)}>
          {KIT_ROLES.map((role) => (
            <option key={role} value={role}>
              {KIT_ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
        <Row label="Roster player">{rosterLabel(settings.roster) || "None"}</Row>
      </Section>
      <Section title="Tools">
        <div className="flex flex-col gap-2">
          <ToolButton icon={<Icon icon={ScanSearch} size={20} />} onClick={() => store.setEditing(board.id)} testId="mockup-edit">
            Edit mockup
          </ToolButton>
          <ToolButton icon={<Icon icon={Clapperboard} size={20} />} disabled={busy} onClick={() => commands.addBoard("ai_video", { x: box.x + box.width + 112, y: box.y }, board.id)}>
            AI video board
          </ToolButton>
        </div>
      </Section>
    </div>
  );
}

/**
 * The board side of edit mode: a double-click opens it, and while it is open the scene's garment slots
 * are drawn as blue boxes with corner marks over the mockup. Wraps the board's own card, so nothing
 * about the card changes.
 */
export function MockupEditFrame({ board, children }: Readonly<{ board: BoardView; children: ReactNode }>) {
  const store = useCanvasStore();
  const editing = useCanvas((state) => state.editing) === board.id;
  const scene = editing ? sceneOf(board) : null;
  return (
    <div
      className="relative h-full"
      onDoubleClick={(event) => {
        event.stopPropagation();
        store.select(board.id);
        store.setEditing(board.id);
      }}
      data-editing={editing || undefined}
    >
      {children}
      {editing ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl outline-2 outline-electric" data-testid={`mockup-editing-${board.id}`}>
          {(scene?.slots ?? []).map((slot) => (
            <span
              key={slot.index}
              className="absolute border border-electric"
              style={{ left: `${slot.frame.x * 100}%`, top: `${slot.frame.y * 100}%`, width: `${slot.frame.width * 100}%`, height: `${slot.frame.height * 100}%` }}
            >
              <i className="absolute -top-1 -left-1 size-2 border border-electric bg-bg" />
              <i className="absolute -top-1 -right-1 size-2 border border-electric bg-bg" />
              <i className="absolute -bottom-1 -left-1 size-2 border border-electric bg-bg" />
              <i className="absolute -right-1 -bottom-1 size-2 border border-electric bg-bg" />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
