"use client";

import { useState } from "react";
import type { ChipTone, FindingLine, ValidateChip as ChipView } from "@/lib/editor";
import { WhyButton } from "./WhyButton";

const TONES: Readonly<Record<ChipTone, string>> = {
  clear: "border-white/20 text-ink",
  warning: "border-warn/40 text-warn",
  blocked: "border-warn/60 text-warn",
  unchecked: "border-white/15 text-ink-2",
};

type Props = Readonly<{ chip: ChipView; findings: readonly FindingLine[] }>;

/**
 * The Validate chip of the top bar and the list it opens (spec F-S4). Every finding carries its
 * rulebook entry, so every one of them has a Why? beside it: the platform never shows a rule it
 * cannot explain. The chip's accessible description says the count in words, because a tick says
 * nothing to a screen reader.
 */
export function ValidateChip({ chip, findings }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="validate-findings"
        aria-describedby="validate-chip-note"
        data-testid="validate-chip"
        className={`chip-btn inline-flex h-10 items-center rounded-full border bg-transparent px-4 text-sm font-medium ${TONES[chip.tone]}`}
      >
        {chip.label}
      </button>
      <span id="validate-chip-note" className="sr-only">
        {chip.description}
      </span>
      {open ? (
        <div
          id="validate-findings"
          className="glass absolute right-0 z-30 mt-2 flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2 rounded-2xl p-4 text-left shadow-lg"
        >
          <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">What the checks found</h2>
          {findings.length === 0 ? (
            <p className="text-sm text-ink">{chip.description}</p>
          ) : (
            <ul className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
              {findings.map((line) => (
                <li key={line.key} className="flex flex-col gap-1">
                  <p className="text-sm text-ink">
                    <span className={`font-medium ${line.severity === "blocker" ? "text-warn" : "text-ink-2"}`}>
                      {line.severity === "blocker" ? "Must fix" : "Have a look"}
                    </span>
                    {line.target ? <span className="text-chalk-muted"> · {line.target}</span> : null} {line.message}
                  </p>
                  <WhyButton ruleId={line.ruleId} context={`validate ${line.key}`} />
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-10 items-center self-start text-sm font-medium text-ink underline">
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
