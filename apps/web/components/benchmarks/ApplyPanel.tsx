import type { BaseArticleSummary } from "@/lib/catalogue";
import type { ApplyPlan, DesignAroundReport } from "@/lib/benchmarks";

/**
 * "Apply to my design" (spec F-S2 step 6) and the design-around warning beside it (F-S2 guardrails).
 *
 * The panel shows what a feature would become on the chosen base article — an option with its catalogue code, or a
 * parameter with the range the factory approved — and what the base simply cannot do, said plainly. Every line carries
 * the rule id of the catalogue row behind it, which is what a "Why?" resolves (F-S5). Nothing here is applied by
 * itself: the person chooses, in the editor, from the base's own options.
 */

const RULE = "font-mono text-xs text-muted";

const ArticlePicker = ({ articles, chosen }: Readonly<{ articles: readonly BaseArticleSummary[]; chosen: string | null }>) => (
  <form method="get" className="flex flex-wrap items-end gap-3">
    <div className="flex flex-col gap-1.5">
      <label htmlFor="apply-article" className="text-sm font-medium text-ink">
        Map these features onto
      </label>
      <select
        id="apply-article"
        name="article"
        defaultValue={chosen ?? ""}
        className="min-h-11 rounded-xl border border-hairline bg-surface px-3 text-[15px] text-ink"
      >
        <option value="">Choose a base product</option>
        {articles.map((article) => (
          <option key={article.code} value={article.code}>
            {article.name} ({article.code})
          </option>
        ))}
      </select>
    </div>
    <button type="submit" className="min-h-11 rounded-full border border-white/20 bg-white/[0.04] px-5 text-[15px] text-ink">
      Show the mapping
    </button>
  </form>
);

const Mapped = ({ plan }: Readonly<{ plan: ApplyPlan }>) => (
  <ul className="flex flex-col gap-3">
    {plan.mapped.map((feature) => (
      <li key={feature.featureKey} className="flex flex-col gap-0.5" data-testid={`mapped-${feature.featureKey}`}>
        <span className="text-[15px] text-ink">
          {feature.featureLabel} →{" "}
          {feature.target.kind === "option"
            ? `${feature.target.label} (${feature.target.group} ${feature.target.code})`
            : `${feature.target.key}, ${feature.target.min ?? "?"} to ${feature.target.max ?? "?"}${feature.target.unit ? ` ${feature.target.unit}` : ""}`}
        </span>
        <span className="text-xs text-muted">{feature.purpose}</span>
        <span className={RULE}>Why? {feature.ruleId}</span>
      </li>
    ))}
  </ul>
);

export function ApplyPanel({
  plan,
  articles,
  chosen,
  report,
}: Readonly<{ plan: ApplyPlan | null; articles: readonly BaseArticleSummary[]; chosen: string | null; report: DesignAroundReport | null }>) {
  return (
    <section className="mt-8 flex flex-col gap-5 rounded-2xl border border-hairline bg-surface p-5" aria-labelledby="apply-heading">
      <h3 id="apply-heading" className="text-base font-medium text-ink">
        Apply features to a base product
      </h3>
      <ArticlePicker articles={articles} chosen={chosen} />

      {plan === null ? (
        <p className="text-[15px] text-muted">Choose a base product to see which of these features it can make.</p>
      ) : (
        <>
          {plan.mapped.length === 0 ? (
            <p className="text-[15px] text-muted">None of this product&rsquo;s features map onto {plan.articleCode} yet.</p>
          ) : (
            <Mapped plan={plan} />
          )}

          {plan.unsupported.length > 0 ? (
            <div data-testid="unsupported">
              <h4 className="text-sm font-medium text-ink">Not available on this base</h4>
              <ul className="mt-2 flex flex-col gap-1">
                {plan.unsupported.map((feature) => (
                  <li key={feature.featureKey} className="text-[15px] text-muted">
                    {feature.featureLabel} — {feature.message} <span className={RULE}>{feature.ruleId}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h4 className="text-sm font-medium text-ink">Never carried over</h4>
            <ul className="mt-2 flex flex-col gap-1">
              {plan.neverCarried.map((item) => (
                <li key={item.label} className="text-[15px] text-muted">
                  {item.label} — {item.why}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {report !== null && report.findings.length > 0 ? (
        <div className="rounded-xl border border-warn/30 bg-warn-wash p-4" role="status" data-testid="design-around">
          <h4 className="text-sm font-medium text-warn">Your design is coming close to this one</h4>
          <ul className="mt-2 flex flex-col gap-2">
            {report.findings.map((finding) => (
              <li key={finding.code} className="text-[15px] text-warn">
                {finding.message}
                <span className="mt-0.5 block text-xs">In common: {finding.shared.join(", ")}</span>
                <span className={`mt-0.5 block ${RULE}`}>{finding.ruleId}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
