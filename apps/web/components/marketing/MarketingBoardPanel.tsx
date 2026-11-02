"use client";

import { useState } from "react";
import type { LaunchPanelProps } from "@/lib/launch";
import {
  MARKETING_FORMAT_LABELS,
  PANEL_WORDS,
  asSettings,
  emptySlots,
  fillLayout,
  marketingBoards,
  pictureSlots,
  selectedMarketing,
  withPicture,
  withTemplate,
  type MarketingSlot,
  type MarketingTemplate,
} from "@/lib/marketing";
import { ArtboardPreview } from "./ArtboardPreview";
import { CampaignForm } from "./CampaignForm";
import { ExportPanel } from "./ExportPanel";
import { PANEL_CHIP, PanelFrame } from "./PanelFrame";
import { TemplatePicker } from "./TemplatePicker";
import { useMarketingServices } from "./services";

/**
 * THE MARKETING BOARD'S INSPECTOR (L1's `board-marketing`; spec F-L2; plan v5 L4, decision 0094).
 *
 * With a layout: a picture of the artboard, what is still empty, Replace for each picture slot, the
 * export panel, and the campaign form. Without one: the fifty layouts to pick from, which is the one
 * action that fills it.
 *
 * Replace keeps the size and the colours, because a slot carries its rectangle and its colour role
 * and a replacement carries neither (`lib/marketing/replace.ts`).
 */
export default function MarketingBoardPanel({ context, commands }: LaunchPanelProps) {
  const { pictures } = useMarketingServices();
  const selected = selectedMarketing(context);
  const [problem, setProblem] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showCampaign, setShowCampaign] = useState(false);

  if (selected === null) {
    return (
      <PanelFrame id="board-marketing" ready={false} busy={context.busy} onAction={() => commands.addBoard("marketing", { x: 0, y: 0 })}>
        <p className="text-[12px] text-ink-2">{PANEL_WORDS["board-marketing"].empty}</p>
      </PanelFrame>
    );
  }

  const pick = (template: MarketingTemplate): void => {
    setProblem(null);
    commands.setBoardSettings(selected.board.id, asSettings(withTemplate(selected.settings, template)));
  };

  const replace = (slot: MarketingSlot, fileId: string): void => {
    const offered = pictures.find((one) => one.fileId === fileId);
    if (!offered) return setProblem("That picture is not one of yours.");
    const verdict = withPicture(selected.settings, slot, offered);
    if (!verdict.ok) return setProblem(verdict.reason);
    setProblem(null);
    setEditing(null);
    commands.setBoardSettings(selected.board.id, asSettings(verdict.settings));
  };

  if (selected.layout === null) {
    return (
      <PanelFrame id="board-marketing" ready busy={context.busy} problem={problem}>
        <TemplatePicker current={selected.settings.templateSlug} busy={context.busy} onPick={pick} />
      </PanelFrame>
    );
  }

  const filled = fillLayout(selected.slots, new Map());
  const left = emptySlots(selected.slots, filled);
  const others = marketingBoards(context).filter((one) => one.id !== selected.board.id);

  return (
    <PanelFrame id="board-marketing" ready busy={context.busy} problem={problem}>
      <ArtboardPreview slots={selected.slots} settings={selected.settings} size={selected.board.size} highlight={editing} />

      <p className="text-[12px] leading-relaxed text-ink-2">
        {selected.layout.title} · {selected.settings.format ? MARKETING_FORMAT_LABELS[selected.settings.format] : "no size yet"}
      </p>

      {left.length > 0 ? (
        <p className="text-[12px] leading-relaxed text-ink-2" data-testid="marketing-left-to-fill">
          Still to fill: {left.map((slot) => slot.label).join(", ")}.
        </p>
      ) : null}

      <section aria-label="Pictures" className="flex flex-col gap-2">
        <h4 className="font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">Pictures</h4>
        <ul className="flex flex-col gap-2">
          {pictureSlots(selected.slots).map((slot) => (
            <li key={slot.id} className="flex min-w-0 flex-col gap-1.5">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-[13px] text-ink">{slot.label}</span>
                <button type="button" disabled={context.busy} className={PANEL_CHIP} onClick={() => setEditing(editing === slot.id ? null : slot.id)} data-testid={`marketing-replace-${slot.id}`}>
                  Replace
                </button>
              </div>
              {editing === slot.id ? (
                pictures.length === 0 ? (
                  <p className="text-[12px] leading-relaxed text-ink-2">
                    No picture of your own yet. A mockup board or a golden-sample photograph is what goes here; a generated picture never can.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {pictures.map((picture) => (
                      <li key={picture.fileId}>
                        <button type="button" disabled={context.busy} className={PANEL_CHIP} onClick={() => replace(slot, picture.fileId)}>
                          {picture.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
              <p className="text-[12px] text-ink-2">Replace keeps this slot&rsquo;s size and colours.</p>
            </li>
          ))}
        </ul>
      </section>

      <ExportPanel board={selected.board} others={others} busy={context.busy} unit={context.unit} />

      <section aria-label="Product campaign kit" className="flex flex-col gap-2">
        <button type="button" aria-expanded={showCampaign} className={PANEL_CHIP} onClick={() => setShowCampaign(!showCampaign)} data-testid="marketing-campaign-toggle">
          {showCampaign ? "Hide the campaign form" : "Start from a campaign instead"}
        </button>
        {showCampaign ? <CampaignForm presets={context.presets} busy={context.busy} onAdd={null} /> : null}
      </section>

      <TemplatePicker current={selected.settings.templateSlug} busy={context.busy} onPick={pick} />
    </PanelFrame>
  );
}
