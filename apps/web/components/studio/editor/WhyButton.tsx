"use client";

import { useId, useRef, useState, useTransition } from "react";
import { whyButtonProps, whyPanelProps } from "@/components/rulebook/a11y";
import { WhyCard } from "@/components/rulebook/WhyCard";
import { explainRuleAction } from "@/lib/rulebook/actions";
import type { WhyView } from "@/lib/rulebook/view";

/**
 * The editor's "Why?" link: the rulebook's own popover (decision 0067) with a trigger a thumb can
 * hit. `components/rulebook/WhyPopover` draws its trigger at the height of its text, which is
 * under the 40 px tap target decision 0064 holds every screen to, and the editor is the first
 * screen to put a Why? on a phone. The words, the attributes and the card are the rulebook's; only
 * the size of the trigger is the editor's own.
 */
export function WhyButton({ ruleId, context }: Readonly<{ ruleId: string; context: string }>) {
  const panelId = useId();
  const headingId = useId();
  const ids = { ruleId, panelId, headingId };
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<WhyView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const toggle = () => {
    if (open) return close();
    setOpen(true);
    if (view) return;
    start(async () => {
      const reply = await explainRuleAction({ ruleId, context });
      if (reply.success) setView(reply.data);
      else setFailed(reply.error.message);
    });
  };

  return (
    <span className="relative inline-block">
      <button
        ref={button}
        {...whyButtonProps(ids, open)}
        onClick={toggle}
        className="soft-link inline-flex min-h-10 min-w-10 items-center justify-center px-2 text-sm font-medium"
      >
        Why?
      </button>
      {open ? (
        <div
          ref={panel}
          {...whyPanelProps(ids, pending)}
          data-testid="why-panel"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          className="glass absolute right-0 z-30 mt-2 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl p-4 text-left shadow-lg"
        >
          {view ? (
            <WhyCard view={view} headingId={headingId} />
          ) : (
            <p id={headingId} role="status" className="text-sm text-muted">
              {failed ?? "Finding the rule."}
            </p>
          )}
          <button type="button" onClick={close} className="inline-flex min-h-10 items-center self-start text-sm font-medium text-ink underline">
            Close
          </button>
        </div>
      ) : null}
    </span>
  );
}
