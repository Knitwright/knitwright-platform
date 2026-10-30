"use client";

import { EXPORT_BLOCKED_REASON, type CheckLine, type ReviewView, type TechPackTabId } from "@/lib/techpack/view";
import { WhyButton } from "../WhyButton";

/**
 * The **Review** tab (spec F-S6): every field still waiting for the person, then the F-G2
 * pre-export check, and the sentence that says the export is held.
 *
 * Nothing on this tab says a design is finished. The clearest it gets is that nothing on the tab
 * stops the export, which is a statement about this tab and not about the garment.
 */

type Props = Readonly<{
  review: ReviewView;
  onGoToTab: (tab: TechPackTabId) => void;
}>;

const STATE_MARK: Readonly<Record<CheckLine["state"], string>> = {
  clear: "✓",
  blocked: "✕",
  "read-elsewhere": "→",
};

const STATE_WORDS: Readonly<Record<CheckLine["state"], string>> = {
  clear: "Nothing stops the export here",
  blocked: "This stops the export",
  "read-elsewhere": "Read somewhere else",
};

const STATE_CLASS: Readonly<Record<CheckLine["state"], string>> = {
  clear: "text-ok",
  blocked: "text-warn",
  "read-elsewhere": "text-chalk-muted",
};

export function ReviewTab({ review, onGoToTab }: Props) {
  return (
    <div className="flex flex-col gap-4" data-testid="techpack-review">
      <p role="status" className="text-[13px] leading-relaxed text-ink" data-testid="techpack-review-summary">
        {review.summary}
      </p>
      {review.exportBlocked ? (
        <p className="rounded-2xl border border-warn/50 p-3 text-[13px] leading-relaxed text-warn" data-testid="techpack-export-blocked">
          {EXPORT_BLOCKED_REASON}
        </p>
      ) : null}
      <section aria-labelledby="techpack-review-waiting" className="flex flex-col gap-2">
        <h4 id="techpack-review-waiting" className="font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">
          Waiting for you
        </h4>
        {review.items.length === 0 ? (
          <p className="text-[13px] text-chalk-muted">No field of any tab is empty.</p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="techpack-review-items">
            {review.items.map((item) => (
              <li key={`${item.tabId}-${item.cellId}`} className="flex min-h-10 flex-wrap items-center gap-2 text-[13px] text-ink">
                <button type="button" onClick={() => onGoToTab(item.tabId)} className="min-h-10 px-1 text-left font-medium text-ink underline">
                  {item.tabLabel}
                </button>
                <span className="min-w-0 flex-1">{item.label}</span>
                <span className="font-mono text-[11px] text-chalk-muted">{item.ruleId}</span>
                <WhyButton ruleId={item.ruleId} context={`techpack review ${item.cellId}`} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="techpack-review-checks" className="flex flex-col gap-2">
        <h4 id="techpack-review-checks" className="font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">
          The pre-export check
        </h4>
        <ul className="flex flex-col gap-2" data-testid="techpack-review-checks">
          {review.checks.map((check) => (
            <li key={check.id} className="flex flex-col gap-0.5" data-testid={`techpack-check-${check.id}`}>
              <span className="flex flex-wrap items-center gap-2 text-[13px] text-ink">
                <span aria-hidden="true" className={STATE_CLASS[check.state]}>
                  {STATE_MARK[check.state]}
                </span>
                <span className="sr-only">{STATE_WORDS[check.state]}.</span>
                <span className="min-w-0 flex-1">{check.label}</span>
                <WhyButton ruleId={check.ruleId} context={`techpack check ${check.id}`} />
              </span>
              <span className={`text-[11px] leading-relaxed ${STATE_CLASS[check.state]}`}>{check.detail}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
