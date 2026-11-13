"use client";

import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import { useState } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import type { ChipTone, FindingLine, ValidateChip as ChipView } from "@/lib/editor";
import { WhyButton } from "./WhyButton";

const GLYPH: Readonly<Record<ChipTone, typeof CircleCheck>> = {
  clear: CircleCheck,
  warning: CircleAlert,
  blocked: CircleAlert,
  unchecked: CircleDashed,
};

type Props = Readonly<{ chip: ChipView; findings: readonly FindingLine[] }>;

/**
 * The checks' chip and the list it opens (spec F-S4). In Garment Studio it is "Fit checked", top right
 * of the stage (decision 0150), and takes its colour from there. Every finding carries its rulebook
 * entry, so every one of them has a Why? beside it: the platform never shows a rule it cannot explain.
 * The chip's accessible description says the count in words, because a tick says nothing to a screen
 * reader.
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
        className="inline-flex h-11 items-center gap-2 rounded-lg px-3.5 text-body font-semibold text-current live:hover:bg-soft"
      >
        <Icon icon={GLYPH[chip.tone]} size={20} />
        {chip.label}
      </button>
      <span id="validate-chip-note" className="sr-only">
        {chip.description}
      </span>
      {open ? (
        <div id="validate-findings" className="absolute right-0 z-50 mt-2 flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2 rounded-2xl border border-border bg-bg p-4 text-left shadow-e3">
          <h2 className="text-micro text-muted uppercase">What the checks found</h2>
          {findings.length === 0 ? (
            <p className="text-body text-text">{chip.description}</p>
          ) : (
            <ul className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
              {findings.map((line) => (
                <li key={line.key} className="flex flex-col gap-1">
                  <p className="text-body text-text">
                    <span className={cx("font-semibold", line.severity === "blocker" ? "text-bad" : "text-warn")}>{line.severity === "blocker" ? "Must fix" : "Have a look"}</span>
                    {line.target ? <span className="text-muted"> · {line.target}</span> : null} {line.message}
                  </p>
                  <WhyButton ruleId={line.ruleId} context={`validate ${line.key}`} />
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-10 items-center self-start text-body font-semibold text-link">
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
