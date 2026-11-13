"use client";

import { useState } from "react";
import { ToneArt } from "@/components/ai-studio/art";
import { Tabs, tabPanelProps } from "@/components/ui/Tabs";
import { TONES } from "@/lib/ai-studio/catalogue";
import type { PromptRow } from "@/lib/prompt-bar";
import { SplitModal } from "./SplitModal";

/**
 * + menu → Prompts (decision 0149; `08` v3.3, prototype e40): History and Presets. Each row is a
 * 160 × 106 picture, a bold title and a two-line prompt; choosing one puts its words in the prompt
 * box, where the person reads them before anything is sent. History is this canvas's own AI boards'
 * prompts (`historyOf`); Presets are `presetsFor(mode)`.
 */

type Props = Readonly<{
  open: boolean;
  onClose: () => void;
  history: readonly PromptRow[];
  presets: readonly PromptRow[];
  onPick: (prompt: string) => void;
}>;

const TABS = [
  { id: "history", label: "History" },
  { id: "presets", label: "Presets" },
] as const;

const ID = "prompts-modal";

export function PromptsModal({ open, onClose, history, presets, onPick }: Props) {
  const [tab, setTab] = useState<"history" | "presets">(history.length > 0 ? "history" : "presets");
  const rows = tab === "history" ? history : presets;
  return (
    <SplitModal open={open} onClose={onClose} title="Prompts" size="md" testId="prompts-modal">
      <Tabs items={TABS} value={tab} onChange={(id) => setTab(id as typeof tab)} label="Prompts" idBase={ID} />
      <div {...tabPanelProps(ID, tab)} className="flex flex-col gap-1">
        {rows.length === 0 ? (
          <p className="py-6 text-body text-muted">
            {tab === "history" ? "No prompts on this canvas yet. Every AI board you make keeps its prompt here." : "No presets for this mode."}
          </p>
        ) : (
          rows.map((row, index) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                onPick(row.prompt);
                onClose();
              }}
              className="flex items-center gap-5 rounded-xl p-3 text-left transition-colors duration-fast live:hover:bg-soft focus-visible:bg-soft"
              data-prompt={row.id}
            >
              <ToneArt tone={TONES[index % TONES.length]!} className="aspect-auto h-26.5 w-40 shrink-0 rounded-md" />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-title font-bold text-text">{row.title}</span>
                <span className="line-clamp-2 text-body-lg font-normal text-text-2">{row.prompt}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </SplitModal>
  );
}
