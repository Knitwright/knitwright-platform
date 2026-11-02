import type { BestPracticeCard as Card } from "@/lib/rulebook/ask/types";
import { WhyLink } from "../WhyLink";
import { bestPracticeProps } from "./a11y";

/**
 * The best-practice card shown when a part is selected (spec F-S5 v2). Every line is the rulebook's own best
 * practice for one rule, with that rule's "Why?" beside it. A part the rulebook says nothing about shows one
 * line saying so and the "Why?" of R-GAP-000, which is how the team learns the card is wanted.
 */
export function BestPracticeCard({ card }: Readonly<{ card: Card }>) {
  return (
    <div {...bestPracticeProps(card.part, card.label)} className="glass flex flex-col gap-2 rounded-2xl p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">Best practice · {card.label}</p>
      {card.kind === "none" ? (
        <>
          <p className="text-[15px] text-ink">{card.message}</p>
          <p>
            <WhyLink ruleId={card.ruleId} context={`Best practice: ${card.part}`} label="What this means" />
          </p>
        </>
      ) : (
        <ul className="flex flex-col gap-2">
          {card.lines.map((line) => (
            <li key={line.ruleId} className="flex flex-col gap-1">
              <p className="text-[15px] text-ink">{line.text}</p>
              {line.newerDraft ? <p className="text-sm text-warn">{line.newerDraft}</p> : null}
              <p className="text-sm text-muted">
                {line.title} <WhyLink ruleId={line.ruleId} context={`Best practice: ${card.part}`} label={`Why? ${line.ruleId}`} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
