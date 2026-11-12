"use client";

import { useState, useTransition } from "react";
import { FlowTemplates } from "@/components/flows/FlowTemplates";
import { Notice } from "@/components/ui/Notice";
import { isGarmentKind, type LaunchPanelProps } from "@/lib/launch";
import { applyFlowTemplateAction } from "@/lib/flows/actions";
import { dropOrigin } from "./placing-packs";

/**
 * THE SIX LAUNCH PACKS IN THE TEMPLATES PANEL (spec F-L4; decisions 0096 and 0108).
 *
 * L1's own contract says where a flow template belongs: the `templates` panel of the rail is for
 * "Marketing, kit-bundle and **flow** templates" (`lib/launch/panels.ts`, `PLACEHOLDERS.templates`).
 * L6 built the picker (`components/flows/FlowTemplates.tsx`) and left it for whoever mounted that
 * panel; decision 0108 built the panel for design templates and said a flow "is started from the
 * canvas", which was true of nothing: no screen offered a pack. This is that door.
 *
 * The action is called inside a transition and revalidates the canvas itself, so the boards appear
 * without this panel asking the router for anything; nothing here holds a copy of the canvas.
 *
 * Opening a pack is **one save on the server** (`applyFlowTemplateAction`): the boards and the
 * connectors all go through L1's own `save_launch_board` and `connect_launch_boards`, so a pack
 * cannot wire a canvas a person could not have wired by hand. Nothing is run and nothing is
 * charged: a pack lays the boards out and the canvas's own Run all shows the cost first.
 */

const CANNOT_REACH = "The pack could not be opened. Check your connection and try again.";

export function FlowPacks({ context }: LaunchPanelProps) {
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);
  const [pending, start] = useTransition();
  const { project } = context;
  const designBoard = project.boards.find((board) => isGarmentKind(board.kind)) ?? null;

  const open = (template: string) => {
    setNote(null);
    start(async () => {
      const reply = await applyFlowTemplateAction({
        launchProjectId: project.id,
        template,
        designProjectId: project.designProjectId,
        designVersion: designBoard?.inputVersion ?? null,
        ...dropOrigin(project.boards),
      }).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: CANNOT_REACH });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      setNote({
        tone: "ok",
        text: `${reply.data.boards} boards are on the canvas, for ${reply.data.assets} assets. Nothing has run and nothing has been charged yet.`,
      });
    });
  };

  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-3" data-testid="launch-flow-packs">
      <FlowTemplates busy={pending || context.busy} onOpen={open} />
      {designBoard === null ? (
        <p className="text-[12px] leading-relaxed text-ink-2">
          This canvas has no Design board yet, so a pack opens with its Design board empty. Put your design on it and every
          output comes from the garment the platform drew.
        </p>
      ) : null}
      {note ? (
        <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
          {note.text}
        </Notice>
      ) : null}
    </div>
  );
}
