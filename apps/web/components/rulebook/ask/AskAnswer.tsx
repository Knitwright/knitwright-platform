import { WhyLink } from "../WhyLink";
import type { AskResult, RetrievedRule } from "@/lib/rulebook/ask/types";

/**
 * What an answer looks like on the page (spec F-S5 v2). Every sentence is shown with a "Why?" link to each rule
 * it cites, so a founder can read the rule's own words beside the sentence that restates it.
 *
 * Three of the four endings show no model's words at all: a question nothing covers, an answer the grader turned
 * down, and no model switched on. Each shows the rules the search found in the rulebook's own words instead, so
 * the box is useful without ever being the place a fact is made up.
 */

const RuleCards = ({ rules }: Readonly<{ rules: readonly RetrievedRule[] }>) => (
  <ul className="flex flex-col gap-3" data-testid="ask-rules">
    {rules.map((rule) => (
      <li key={rule.ruleId} className="glass flex flex-col gap-1 rounded-2xl p-3">
        <p className="font-semibold text-ink">
          <span className="font-mono text-xs uppercase tracking-wider text-muted">Rulebook {rule.ruleId}</span> <span>{rule.title}</span>
        </p>
        <p className="text-[15px] text-ink">{rule.rule}</p>
        <p className="text-sm text-muted">Covers: {rule.scope}</p>
        {rule.newerDraft ? <p className="text-sm text-warn">{rule.newerDraft}</p> : null}
        <p>
          <WhyLink ruleId={rule.ruleId} context="Ask" />
        </p>
      </li>
    ))}
  </ul>
);

export function AskAnswer({ result }: Readonly<{ result: AskResult }>) {
  if (result.kind === "not_covered") {
    return (
      <div className="flex flex-col gap-2" data-testid="ask-not-covered">
        <p className="text-[15px] text-ink">{result.message}</p>
        <p>
          <WhyLink ruleId={result.ruleId} context="Ask" label="What this means" />
        </p>
      </div>
    );
  }
  if (result.kind === "answer") {
    return (
      <div className="flex flex-col gap-3" data-testid="ask-answer">
        {result.sentences.map((sentence, index) => (
          <p key={index} className="text-[15px] text-ink">
            {sentence.text}{" "}
            {sentence.ruleIds.map((ruleId) => (
              <WhyLink key={ruleId} ruleId={ruleId} context="Ask" label={`Why? ${ruleId}`} />
            ))}
          </p>
        ))}
        <RuleCards rules={result.rules} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3" data-testid={result.kind === "ungrounded" ? "ask-ungrounded" : "ask-unavailable"}>
      <p className="text-[15px] text-ink">{result.message}</p>
      <RuleCards rules={result.rules} />
    </div>
  );
}
