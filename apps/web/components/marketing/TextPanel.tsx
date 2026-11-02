"use client";

import { useId, useState } from "react";
import type { LaunchPanelProps } from "@/lib/launch";
import { asSettings, selectedMarketing, withWords, writableSlots, type MarketingSlot } from "@/lib/marketing";
import { PANEL_FIELD, PanelFrame } from "./PanelFrame";

/**
 * THE TEXT PANEL (spec Launch shell "Text"; F-L2: "Text uses the brand's Headline / Subheadline /
 * Body styles"; plan v5 L4, decision 0094).
 *
 * One field per text slot of the selected layout, each in the brand style that slot is set in, each
 * with the character limit `07` asks for shown and enforced. Nothing here writes: every change is
 * `setBoardSettings`, which the shell checks and saves.
 *
 * With no marketing board selected the panel says so and offers to add one, which is the one action
 * that fills it.
 */
export default function TextPanel({ context, commands }: LaunchPanelProps) {
  const selected = selectedMarketing(context);
  const [problem, setProblem] = useState<string | null>(null);
  const fields = selected ? writableSlots(selected.slots) : [];

  const write = (slot: MarketingSlot, words: string): void => {
    if (!selected) return;
    const verdict = withWords(selected.settings, slot, words);
    if (!verdict.ok) return setProblem(verdict.reason);
    setProblem(null);
    commands.setBoardSettings(selected.board.id, asSettings(verdict.settings));
  };

  return (
    <PanelFrame
      id="text"
      ready={fields.length > 0}
      busy={context.busy}
      problem={problem}
      onAction={() => commands.addBoard("marketing", { x: 0, y: 0 })}
    >
      <ul className="flex flex-col gap-3">
        {fields.map((slot) => (
          <li key={slot.id}>
            <TextField slot={slot} value={selected?.settings.words[slot.id] ?? ""} busy={context.busy} onWrite={(words) => write(slot, words)} />
          </li>
        ))}
      </ul>
      <p className="text-[12px] leading-relaxed text-ink-2">
        Each field is set in your brand&rsquo;s own style. Write for me, in the AI assistant panel, offers three lines for the field you pick.
      </p>
    </PanelFrame>
  );
}

type FieldProps = Readonly<{ slot: MarketingSlot; value: string; busy: boolean; onWrite: (words: string) => void }>;

function TextField({ slot, value, busy, onWrite }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [typed, setTyped] = useState<string | null>(null);
  const shown = typed ?? value;
  const over = slot.limit !== null && shown.length > slot.limit;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {slot.label}
      </label>
      <input
        id={id}
        type="text"
        value={shown}
        disabled={busy}
        maxLength={slot.limit ?? undefined}
        aria-describedby={hintId}
        aria-invalid={over || undefined}
        placeholder={slot.placeholder ?? undefined}
        className={PANEL_FIELD}
        onChange={(event) => setTyped(event.target.value)}
        onBlur={() => {
          if (typed !== null && typed !== value) onWrite(typed);
          setTyped(null);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (typed !== null) onWrite(typed);
          setTyped(null);
        }}
      />
      <p id={hintId} className="text-[12px] text-ink-2">
        {slot.style === null ? "Your own words." : `${slot.style} style`}
        {slot.limit === null ? "" : ` · ${shown.length} of ${slot.limit} characters`}
      </p>
    </div>
  );
}
