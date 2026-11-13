"use client";

import { BookOpen, ChevronDown, Clapperboard, Ellipsis, Film, Image as ImageIcon, Lock, MessageCircleQuestion, Palette, Plus, RectangleHorizontal, RectangleVertical, Search, Sparkles, Square, SquareDashed, Wand2 } from "lucide-react";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Chips";
import {
  aspectShort,
  countLabel,
  IMAGE_ASPECTS,
  IMAGE_COUNT_CHOICES,
  imageAspectLabel,
  MODES,
  orientationOf,
  PROMPT_MODES,
  searchCards,
  VIDEO_ASPECTS,
  VIDEO_REFERENCE_LABELS,
  VIDEO_REFERENCE_MODES,
  VIDEO_SECONDS,
  type ModelCard,
  type PromptChoices,
  type PromptMode,
} from "@/lib/prompt-bar";
import { ChoiceMenu } from "./ChoiceMenu";

/**
 * The prompt bar's footer menus (decision 0149; `08` v3.2–v3.4): + · mode | model · aspect · count ·
 * ⋯ for an image, model · aspect · length · Reference Mode for a video. Each menu offers only what
 * the board it writes to takes (`lib/prompt-bar/modes.ts`).
 */

type Set = (patch: Partial<PromptChoices>) => void;

const MODE_ICONS = { agentic: Sparkles, image: ImageIcon, video: Film, ask: MessageCircleQuestion } as const;

const SHAPE_ICONS = { portrait: RectangleVertical, landscape: RectangleHorizontal, square: Square, match: SquareDashed } as const;

export function PlusMenu({ disabled, onOpen }: Readonly<{ disabled: boolean; onOpen: (which: "styles" | "builder" | "prompts") => void }>) {
  return (
    <ChoiceMenu
      label="Add to prompt"
      round
      choice={false}
      disabled={disabled}
      trigger={<Icon icon={Plus} size={20} />}
      testId="prompt-plus"
      items={[
        { id: "styles", label: "Browse Styles", icon: <Icon icon={Palette} size={20} />, checked: false },
        { id: "builder", label: "Prompt builder", icon: <Icon icon={Wand2} size={20} />, checked: false },
        { id: "prompts", label: "Prompts", icon: <Icon icon={BookOpen} size={20} />, checked: false },
      ]}
      onChoose={(id) => onOpen(id as "styles" | "builder" | "prompts")}
    />
  );
}

export function ModeMenu({ mode, set }: Readonly<{ mode: PromptMode; set: Set }>) {
  return (
    <ChoiceMenu
      label="Mode"
      width="lg"
      testId="prompt-mode"
      trigger={
        <>
          <Icon icon={MODE_ICONS[mode]} size={20} />
          {MODES[mode].short}
          <Icon icon={ChevronDown} size={16} />
        </>
      }
      items={PROMPT_MODES.map((id) => ({
        id,
        label: MODES[id].label,
        lead: MODES[id].lead,
        icon: <Icon icon={MODE_ICONS[id]} size={20} className="shrink-0" />,
        aside: MODES[id].beta ? <Tag tone="beta">Beta</Tag> : undefined,
        checked: id === mode,
      }))}
      onChoose={(id) => set({ mode: id as PromptMode })}
    />
  );
}

export function ModelMenu({ cards, picked, onPick }: Readonly<{ cards: readonly ModelCard[]; picked: ModelCard | null; onPick: (key: string) => void }>) {
  const [query, setQuery] = useState("");
  const shown = searchCards(cards, query);
  return (
    <ChoiceMenu
      label="Model"
      width="lg"
      testId="prompt-model"
      trigger={
        <>
          <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-gold text-micro text-navy">
            KW
          </span>
          {picked?.label ?? "No model"}
        </>
      }
      header={
        cards.length > 1 ? (
          <div className="flex flex-col gap-2 px-1 pb-2">
            <label className="flex h-10 items-center gap-2 rounded-md border border-border px-3 focus-within:border-electric">
              <Icon icon={Search} size={16} className="text-muted" />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models" aria-label="Search models" className="min-w-0 flex-1 bg-transparent text-body outline-none" />
            </label>
            <p className="px-1 text-caption text-muted">Recommended models</p>
          </div>
        ) : undefined
      }
      items={shown.map((card) => ({
        id: card.key,
        label: card.label,
        lead: [card.lead, card.wait, card.price].filter(Boolean).join(" · "),
        checked: card.key === picked?.key,
        disabled: !card.priced,
        title: card.priced ? undefined : card.price,
      }))}
      footer={shown.length === 0 ? <p className="px-3 py-2 text-body text-muted">No model matches.</p> : undefined}
      onChoose={onPick}
    />
  );
}

const shapeIcon = (aspect: string) => <Icon icon={SHAPE_ICONS[orientationOf(aspect)]} size={16} className="shrink-0 text-muted" />;

export function ImageMenus({ choices, set }: Readonly<{ choices: PromptChoices; set: Set }>) {
  return (
    <>
      <ChoiceMenu
        label="Aspect"
        testId="prompt-aspect"
        trigger={aspectShort(choices.imageAspect)}
        items={IMAGE_ASPECTS.map((aspect) => ({ id: aspect, label: aspect === "match" ? "Match Input" : aspect, lead: aspect === "match" ? imageAspectLabel(aspect) : undefined, icon: shapeIcon(aspect), checked: aspect === choices.imageAspect }))}
        onChoose={(id) => set({ imageAspect: id as PromptChoices["imageAspect"] })}
      />
      <ChoiceMenu
        label="Number of images"
        testId="prompt-count"
        trigger={`${choices.count}×`}
        items={IMAGE_COUNT_CHOICES.map((count) => ({ id: String(count), label: countLabel(count), checked: count === choices.count }))}
        onChoose={(id) => set({ count: Number(id) })}
      />
      <ChoiceMenu
        label="More settings"
        round
        choice={false}
        width="md"
        testId="prompt-more"
        trigger={<Icon icon={Ellipsis} size={20} />}
        items={[
          {
            id: "lock",
            label: "Keep garment exact",
            lead: "Always on: AI changes only what is around your garment.",
            icon: <Icon icon={Lock} size={16} />,
            checked: true,
            disabled: true,
            title: "The garment lock cannot be turned off.",
          },
          {
            id: "transparent",
            label: "Transparent background",
            lead: "Not available yet: no picture service here removes a background.",
            checked: false,
            disabled: true,
            title: "Not available yet.",
          },
        ]}
        onChoose={() => undefined}
      />
    </>
  );
}

export function VideoMenus({ choices, set }: Readonly<{ choices: PromptChoices; set: Set }>) {
  return (
    <>
      <ChoiceMenu
        label="Aspect"
        testId="prompt-aspect"
        trigger={choices.videoAspect}
        items={VIDEO_ASPECTS.map((aspect) => ({ id: aspect, label: aspect, icon: shapeIcon(aspect), checked: aspect === choices.videoAspect }))}
        onChoose={(id) => set({ videoAspect: id as PromptChoices["videoAspect"] })}
      />
      <ChoiceMenu
        label="Length"
        testId="prompt-seconds"
        trigger={`${choices.seconds}s`}
        items={VIDEO_SECONDS.map((seconds) => ({ id: String(seconds), label: `${seconds} seconds`, checked: seconds === choices.seconds }))}
        onChoose={(id) => set({ seconds: Number(id) })}
      />
      <ChoiceMenu
        label="Reference mode"
        width="md"
        testId="prompt-reference-mode"
        trigger={
          <>
            <Icon icon={Clapperboard} size={16} />
            {VIDEO_REFERENCE_LABELS[choices.referenceMode].label}
            <Icon icon={ChevronDown} size={16} />
          </>
        }
        items={VIDEO_REFERENCE_MODES.map((id) => ({ id, label: VIDEO_REFERENCE_LABELS[id].label, lead: VIDEO_REFERENCE_LABELS[id].lead, checked: id === choices.referenceMode }))}
        onChoose={(id) => set({ referenceMode: id as PromptChoices["referenceMode"] })}
      />
    </>
  );
}
