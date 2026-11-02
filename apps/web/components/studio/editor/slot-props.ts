"use client";

import type { BaseArticle } from "@/lib/catalogue";
import type { CanvasView, EditorCommands, EditorDesign, EditorDraft, EditorSlotProps, SummarySectionId } from "@/lib/editor";
import type { SpecAction } from "@/lib/garment";
import type { Shell } from "./useShell";

/**
 * THE SLOT PROPS (the slot contract, `lib/editor/slots.ts`, decision 0075).
 *
 * Four workstreams built a panel against `EditorSlotProps` and the shell never built the props, so
 * every slot still drew its placeholder (code review v5, A7–A12). This is the one place the shell
 * makes them: the design as read-only facts, and the nine commands a panel may call. Nothing else
 * crosses the seam, so a panel still cannot fetch, cannot write to the design and cannot make a
 * value the article does not offer — the shell checks every one of those on the way through.
 *
 * It is a plain function, not a component: a component made while the shell renders is what
 * `react-hooks/static-components` refuses, which is also why the launch shell looks its panels up
 * in a spread map (`components/launch/RailPanels.tsx`).
 */

export type SlotPartsFor = Readonly<{
  shell: Shell;
  projectId: string;
  version: number;
  /** The design as it will be once the saves in flight land (`useEditor`'s `working`). */
  spec: EditorDesign["spec"];
  article: BaseArticle | null;
  sizes: readonly string[];
  colourwayId: string;
  draft: EditorDraft | null;
  busy: boolean;
  /** Saves a change under the name of the control it came from, through the shell's own queue. */
  save: (key: string, action: SpecAction) => void;
  /** Opens one section of the Design Summary, whose editor then shows in the right-hand panel. */
  openSummary: (section: SummarySectionId) => void;
  /** Says the 3D model no longer matches the design, so the chip reads "Not sim ready". */
  needsSimulation: () => void;
}>;

/** Everything every slot panel of this shell is given, and all it is given. */
export function slotPropsFor(parts: SlotPartsFor): EditorSlotProps {
  const { shell } = parts;
  const design: EditorDesign = {
    projectId: parts.projectId,
    version: parts.version,
    spec: parts.spec,
    article: parts.article,
    form: shell.state.form,
    size: shell.state.size,
    sizes: parts.sizes,
    colourwayId: parts.colourwayId,
    draft: parts.draft,
    busy: parts.busy,
  };
  const commands: EditorCommands = {
    setOption: shell.setOption,
    setParameter: shell.setParameter,
    setSize: shell.setSize,
    setColourway: shell.setColourway,
    // The contract's second argument is optional; the shell's own takes it as given.
    showView: (view: CanvasView, beside = false) => shell.showView(view, beside),
    openRail: shell.openRail,
    openSummary: parts.openSummary,
    save: parts.save,
    needsSimulation: parts.needsSimulation,
  };
  return { design, commands };
}
