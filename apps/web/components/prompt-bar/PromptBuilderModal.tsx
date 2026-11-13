"use client";

import { Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { ToneArt } from "@/components/ai-studio/art";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { TONES } from "@/lib/ai-studio/catalogue";
import { BUILDER_CATEGORIES, BUILDER_LABELS, picksIn, surprise, togglePick, type BuilderCategory, type BuilderPick } from "@/lib/prompt-bar";
import { SplitModal } from "./SplitModal";

/**
 * + menu → Prompt builder (decision 0149; `08` v3.3, prototype e39): "All categories are optional".
 * Left, the six categories and Surprise me; right, a 3-column grid of the category's picks, the
 * picked one ringed in electric with a dot; picks collect as chips in a dashed box, and **Add to your
 * prompt** writes them after the person's own words (`lib/prompt-bar/builder.ts`).
 */

type Props = Readonly<{ open: boolean; onClose: () => void; onAdd: (picks: readonly BuilderPick[]) => void }>;

export function PromptBuilderModal({ open, onClose, onAdd }: Props) {
  const [category, setCategory] = useState<BuilderCategory>("style");
  const [chosen, setChosen] = useState<readonly BuilderPick[]>([]);

  const left = (
    <div className="flex flex-1 flex-col gap-4">
      <div role="tablist" aria-label="Categories" aria-orientation="vertical" className="flex flex-col gap-1">
        {BUILDER_CATEGORIES.map((one) => (
          <button
            key={one}
            type="button"
            role="tab"
            aria-selected={one === category}
            onClick={() => setCategory(one)}
            className={cx("rounded-md px-4 py-2.5 text-left text-title transition-colors duration-fast", one === category ? "bg-soft text-text" : "font-normal text-text-2 live:hover:bg-soft")}
          >
            {BUILDER_LABELS[one]}
          </button>
        ))}
      </div>
      <Button variant="secondary" className="mt-auto w-full" icon={<Icon icon={Sparkles} size={16} />} onClick={() => setChosen(surprise(Math.random))}>
        Surprise me
      </Button>
    </div>
  );

  return (
    <SplitModal open={open} onClose={onClose} title="Prompt builder" lead="All categories are optional" left={left} testId="prompt-builder">
      <h3 className="text-h3 text-text">{BUILDER_LABELS[category]}</h3>
      <ul className="grid grid-cols-2 gap-5 md:grid-cols-3" aria-label={`${BUILDER_LABELS[category]} picks`}>
        {picksIn(category).map((pick, index) => {
          const picked = chosen.some((one) => one.id === pick.id);
          return (
            <li key={pick.id}>
              <button type="button" aria-pressed={picked} onClick={() => setChosen(togglePick(chosen, pick))} className="group flex w-full flex-col gap-2 text-left" data-pick={pick.id}>
                <ToneArt tone={TONES[index % TONES.length]!} className={cx("aspect-16/9 rounded-xl ring-electric ring-offset-2 group-focus-visible:ring-2", picked && "ring-2")}>
                  {picked ? <span aria-hidden="true" className="absolute top-2.5 right-2.5 size-3 rounded-full bg-electric ring-2 ring-bg" /> : null}
                </ToneArt>
                <span className="text-body-lg text-text-2">{pick.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex min-h-34 flex-wrap content-start items-start gap-2 rounded-xl border border-dashed border-border-strong p-3" aria-live="polite">
        {chosen.length === 0 ? <p className="text-body text-muted">Your picks collect here.</p> : null}
        {chosen.map((pick) => (
          <button key={pick.id} type="button" onClick={() => setChosen(togglePick(chosen, pick))} className="rounded-full bg-soft px-3 py-1 text-small text-text" aria-label={`Remove ${pick.label}`}>
            {BUILDER_LABELS[pick.category]}: {pick.label} ×
          </button>
        ))}
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto self-end"
          disabled={chosen.length === 0}
          icon={<Icon icon={Plus} size={16} />}
          onClick={() => {
            onAdd(chosen);
            setChosen([]);
            onClose();
          }}
        >
          Add to your prompt
        </Button>
      </div>
    </SplitModal>
  );
}
