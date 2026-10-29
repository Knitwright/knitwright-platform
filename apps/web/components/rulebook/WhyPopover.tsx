"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { Result } from "@/lib/server/core/errors";
import type { WhyView } from "@/lib/rulebook/view";
import { whyButtonProps, whyPanelProps } from "./a11y";
import { WhyCard } from "./WhyCard";

export type Explain = (input: { ruleId: string; context: string }) => Promise<Result<WhyView>>;

type Props = Readonly<{ ruleId: string; context?: string; explain: Explain; label?: string }>;

/**
 * A "Why?" button and its popover. The rule is asked for the first time the popover opens. Escape, the Close button
 * or the Why? button again close it, and focus goes back to the Why? button.
 */
export function WhyPopover({ ruleId, context = "", explain, label = "Why?" }: Props) {
  const panelId = useId();
  const headingId = useId();
  const ids = { ruleId, panelId, headingId };
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<WhyView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  const load = () =>
    start(async () => {
      const reply = await explain({ ruleId, context });
      if (reply.success) {
        setView(reply.data);
        setFailed(null);
      } else setFailed(reply.error.message);
    });

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const toggle = () => {
    if (open) return close();
    setOpen(true);
    if (!view) load();
  };

  return (
    <span className="relative inline-block">
      <button ref={button} {...whyButtonProps(ids, open)} onClick={toggle} className="soft-link text-sm font-medium">
        {label}
      </button>
      {open ? (
        <div
          ref={panel}
          {...whyPanelProps(ids, pending)}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          className="glass absolute left-0 z-20 mt-2 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl p-4 text-left shadow-lg"
        >
          {view ? <WhyCard view={view} headingId={headingId} /> : (
            <p id={headingId} className="text-sm text-muted" role="status">
              {failed ?? "Finding the rule."}
            </p>
          )}
          <button type="button" onClick={close} className="self-start text-sm font-medium text-ink underline">Close</button>
        </div>
      ) : null}
    </span>
  );
}
