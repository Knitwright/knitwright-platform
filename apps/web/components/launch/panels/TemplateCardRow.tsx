"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { USE_TEMPLATE, type TemplateCard } from "@/lib/launch-panels";
import { useTemplateAction } from "@/lib/templates/actions";
import { templateSuffix } from "./a11y";
import { CARD, CHIP } from "./frame";

/**
 * One template's card in the launch rail (plan v5, decision 0108).
 *
 * **A template whose article has no data says so.** `gapForType` (L8, decision 0098) answers with
 * the register of decision 0090: seven of the eight launch articles publish no point of measure and
 * no block, so a card drawn on one of them carries that article's own rule id rather than looking
 * ready to make.
 *
 * The button is the one that already exists: `useTemplateAction` copies the template into the
 * member's own brand as a new design and opens the editor on it. The panel sends the template's id
 * and nothing else; the brand comes from the session.
 */
export function TemplateCardRow({ card, busy }: Readonly<{ card: TemplateCard; busy: boolean }>) {
  const { form, submit, pending, summary } = useFormAction(useTemplateAction);
  return (
    <div className={CARD} data-testid={`launch-template-${card.slug}`}>
      <h4 className="text-[13px] font-medium text-ink">{card.title}</h4>
      <p className="text-[12px] leading-relaxed text-ink-2">
        {card.articleLabel} · {card.reviewLabel}
      </p>
      {card.attribution === null ? null : <p className="text-[12px] leading-relaxed text-ink-2">By {card.attribution}</p>}
      {card.gap === null ? null : (
        <p data-testid={`launch-template-gap-${card.slug}`} className="text-[12px] leading-relaxed text-ink-2">
          {card.gap.line} <span className="font-mono">{card.gap.ruleId}</span>
        </p>
      )}
      <form ref={form} action={submit} className="flex flex-col gap-1.5">
        <FormSummary message={summary} />
        <input type="hidden" name="templateId" value={card.id} />
        <button type="submit" disabled={busy || pending} aria-busy={pending || undefined} className={CHIP} data-testid={`launch-template-use-${card.slug}`}>
          {USE_TEMPLATE}
          <span className="sr-only">{templateSuffix(card.title)}</span>
        </button>
      </form>
    </div>
  );
}
