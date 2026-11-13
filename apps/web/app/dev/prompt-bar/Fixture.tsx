"use client";

import { useState } from "react";
import type { BrandTabColour } from "@/components/brand-studio/BrandTab";
import { CanvasStoreProvider } from "@/components/canvas/CanvasStore";
import { ArtboardSizeModal } from "@/components/pickers/ArtboardSizeModal";
import { ColourPicker } from "@/components/pickers/ColourPicker";
import { FontPicker } from "@/components/pickers/FontPicker";
import { VersionHistory } from "@/components/pickers/VersionHistory";
import { PromptBar } from "@/components/prompt-bar/PromptBar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { ArtboardPreset, LaunchCostSource, LaunchProjectView } from "@/lib/launch";
import type { FontRow, PickedColour } from "@/lib/pickers";
import type { DesignChoice, DesignHistory } from "@/lib/pickers/actions";
import { runToast } from "@/lib/prompt-bar";

/**
 * The E5 pieces with made-up data (decision 0149), one per `?show=`: prompt (open), video, ask,
 * styles, builder, prompts, artboard, history, font, colour and toast. Pressing Send or Create here
 * calls the real actions, which refuse without a session, so what the toast then says is the real
 * refusal. Nothing on this page is an output of any model.
 */

export const SHOWS = ["prompt", "video", "ask", "styles", "builder", "prompts", "artboard", "history", "font", "colour", "toast"] as const;
export type Show = (typeof SHOWS)[number];

type Props = Readonly<{
  show: Show;
  project: LaunchProjectView;
  presets: readonly ArtboardPreset[];
  costs: LaunchCostSource;
  designs: readonly DesignChoice[];
  history: DesignHistory;
  fonts: readonly FontRow[];
  brandFonts: readonly FontRow[];
  brandColours: readonly BrandTabColour[];
}>;

export function Fixture(props: Props) {
  const { show, project } = props;
  const toast = useToast();
  const [colour, setColour] = useState<PickedColour>({ hex: "#0b1f4b", opacity: 100 });
  const [font, setFont] = useState<string | null>("geist");
  const modal = show === "styles" || show === "builder" || show === "prompts" ? show : undefined;
  const mode = show === "video" ? "video" : show === "ask" ? "ask" : "image";

  return (
    <CanvasStoreProvider initial={{ selection: show === "video" ? [] : [project.boards[0]!.id] }}>
      <div className="flex min-h-[calc(100dvh-2rem)] flex-col gap-6 rounded-3xl bg-soft-2 p-6">
        <div className="flex items-start justify-end gap-3">
          {show === "history" ? <VersionHistory designProjectId="00000000-0000-4000-8000-0000000000d1" canEdit fixture={props.history} /> : null}
          {show === "toast" ? (
            <Button variant="secondary" onClick={() => toast.show({ ...runToast({ assets: 0, spent: 0, refunded: 20, reason: "AI image: the picture service timed out" }, "image"), action: { label: "Retry", onAction: () => undefined } })}>
              Show the failure toast
            </Button>
          ) : null}
        </div>
        <div className="flex flex-1 items-start justify-center gap-6">
          {show === "font" ? <FontPicker value={font} onPick={(row) => setFont(row.key)} onClose={() => undefined} fonts={props.fonts} brand={props.brandFonts} /> : null}
          {show === "colour" ? <ColourPicker value={colour} onChange={setColour} onClose={() => undefined} projectColours={["#ffffff", "#0b1f4b", "#f2b705", "#2f6bff", "#d92d20", "#111318"]} brand={props.brandColours} garmentPanel /> : null}
        </div>
        <div className="flex justify-center">
          <PromptBar
            project={project}
            credits={1240}
            costs={props.costs}
            canEdit
            initial={{ open: show !== "toast" && show !== "artboard" && show !== "history", modal, choices: { mode, prompt: mode === "ask" ? "" : "Put this kit on a player walking out of a floodlit stadium tunnel, low angle, editorial sports photography" } }}
          />
        </div>
      </div>
      <ArtboardSizeModal open={show === "artboard"} onClose={() => undefined} launchProjectId={project.id} presets={props.presets} boards={project.boards} designs={props.designs} />
    </CanvasStoreProvider>
  );
}
