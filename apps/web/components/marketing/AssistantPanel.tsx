"use client";

import { useId, useState } from "react";
import type { LaunchPanelProps } from "@/lib/launch";
import {
  CAMPAIGNS,
  CAMPAIGN_LABELS,
  HIGHLIGHT_LIMIT,
  NO_VOICE_NOTE,
  asSettings,
  selectedMarketing,
  voiceWords,
  withWords,
  writableSlots,
  type Campaign,
} from "@/lib/marketing";
import { PANEL_CHIP, PANEL_FIELD, PanelFrame } from "./PanelFrame";
import { NOT_WIRED, useMarketingServices } from "./services";

/**
 * "WRITE FOR ME" (spec F-L2: "Every text field has **Write for me**, which writes AI copy in the
 * brand's voice and tone"; plan v5 L4, decision 0094).
 *
 * Pick a field, say what to highlight, and the panel offers three lines in the brand's voice tags.
 * Nothing is written into the layout until a person picks one of the three, which is the difference
 * between a suggestion and a decision.
 *
 * The call is metered on the server (`lib/marketing/copy/metered.ts`) and the writer arrives through
 * `MarketingServicesProvider`. With no writer, no voice, or no field, the panel says which of those
 * it is -- it never pretends to have written anything.
 */
export default function AssistantPanel({ context, commands }: LaunchPanelProps) {
  const { writer, voice } = useMarketingServices();
  const selected = selectedMarketing(context);
  const fields = selected ? writableSlots(selected.slots) : [];
  const ids = { field: useId(), highlight: useId(), campaign: useId() };

  const [slotId, setSlotId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState("");
  const [campaign, setCampaign] = useState<Campaign | "">("");
  const [options, setOptions] = useState<readonly string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const slot = fields.find((one) => one.id === (slotId ?? fields[0]?.id)) ?? null;

  const run = async (): Promise<void> => {
    if (!slot || !selected) return;
    setOptions([]);
    if (writer === null) return setProblem(NOT_WIRED);
    if (voice === null) return setProblem(NO_VOICE_NOTE);
    setProblem(null);
    setRunning(true);
    try {
      const result = await writer({ slot, highlight, campaign: campaign === "" ? null : campaign, voice });
      if (result.ok) setOptions(result.options);
      else setProblem(result.reason);
    } finally {
      setRunning(false);
    }
  };

  const take = (words: string): void => {
    if (!selected || !slot) return;
    const verdict = withWords(selected.settings, slot, words);
    if (!verdict.ok) return setProblem(verdict.reason);
    setProblem(null);
    setOptions([]);
    commands.setBoardSettings(selected.board.id, asSettings(verdict.settings));
  };

  return (
    <PanelFrame id="assistant" ready={fields.length > 0} busy={context.busy} problem={problem} onAction={() => commands.addBoard("marketing", { x: 0, y: 0 })}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.field} className="text-[13px] font-medium text-ink">
          Field
        </label>
        <select id={ids.field} className={PANEL_FIELD} value={slot?.id ?? ""} disabled={context.busy} onChange={(event) => setSlotId(event.target.value)}>
          {fields.map((one) => (
            <option key={one.id} value={one.id}>
              {one.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.highlight} className="text-[13px] font-medium text-ink">
          What do you want to highlight?
        </label>
        <input
          id={ids.highlight}
          type="text"
          value={highlight}
          maxLength={HIGHLIGHT_LIMIT}
          disabled={context.busy}
          placeholder="Pre-orders close Friday"
          className={PANEL_FIELD}
          onChange={(event) => setHighlight(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.campaign} className="text-[13px] font-medium text-ink">
          Campaign
        </label>
        <select id={ids.campaign} className={PANEL_FIELD} value={campaign} disabled={context.busy} onChange={(event) => setCampaign(event.target.value as Campaign | "")}>
          <option value="">Not saying</option>
          {CAMPAIGNS.map((one) => (
            <option key={one} value={one}>
              {CAMPAIGN_LABELS[one]}
            </option>
          ))}
        </select>
      </div>

      <p className="text-[12px] leading-relaxed text-ink-2">
        {voice === null ? NO_VOICE_NOTE : `Written in your brand’s voice: ${voiceWords(voice)}. Each run is metered.`}
      </p>

      <button type="button" disabled={context.busy || running || slot === null} onClick={() => void run()} className={PANEL_CHIP} data-testid="marketing-write-for-me">
        {running ? "Writing…" : "Write for me"}
      </button>

      <div aria-live="polite" className="flex flex-col gap-2">
        {running ? <p className="text-[12px] text-ink-2">Writing three lines for {slot?.label}…</p> : null}
        {options.length > 0 ? (
          <>
            <h4 className="text-[13px] font-medium text-ink">Three to choose from</h4>
            <ul className="flex flex-col gap-2" data-testid="marketing-write-options">
              {options.map((option) => (
                <li key={option}>
                  <button type="button" disabled={context.busy} onClick={() => take(option)} className={`${PANEL_CHIP} w-full justify-start text-left`}>
                    {option}
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[12px] leading-relaxed text-ink-2">Nothing is on the artboard until you pick one.</p>
          </>
        ) : null}
      </div>
    </PanelFrame>
  );
}
