import { WhyLink } from "@/components/rulebook/WhyLink";
import type { SuggestionsView } from "@/lib/inspiration/view";
import { listProps } from "./a11y";

type Props = Readonly<{
  made: SuggestionsView;
  onApply?: (suggestionId: string) => void;
  busy?: boolean;
}>;

/**
 * The suggestion cards (spec F-S1). Each one is already through validation before it reaches here, so this draws
 * them and says, under them, everything the base article cannot do. One click applies one as a new version.
 */
export function SuggestionList({ made, onApply, busy = false }: Props) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{made.title}</h4>
      {made.empty === null ? (
        <ul {...listProps("Suggestions from this card")} className="flex flex-col gap-2">
          {made.suggestions.map((suggestion) => (
            <li key={suggestion.id} role="listitem" className="glass flex flex-col gap-1 rounded-2xl p-2" data-testid="inspiration-suggestion">
              <p className="text-xs text-ink">{suggestion.line}</p>
              {suggestion.warnings.map((warning) => (
                <p key={warning} className="text-[0.7rem] text-muted">
                  {warning}
                </p>
              ))}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onApply?.(suggestion.id)} disabled={busy} aria-label={suggestion.applyLabel} className="soft-link text-xs font-medium">
                  Apply
                </button>
                <WhyLink ruleId={suggestion.ruleId} context="inspiration-suggestion" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted" role="status">
          {made.empty}
        </p>
      )}
      {made.notPossible.length === 0 ? null : (
        <ul className="flex flex-col gap-1" aria-label="What this base article cannot do">
          {made.notPossible.map((sentence) => (
            <li key={sentence} className="text-[0.7rem] text-muted" data-testid="inspiration-not-possible">
              {sentence}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[0.7rem] text-muted">{made.note}</p>
    </section>
  );
}
