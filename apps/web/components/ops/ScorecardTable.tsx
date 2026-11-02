import { NO_DEFECT_RATE_AGREED, percent, type FactoryScorecard } from "@/lib/ops/scorecard/compute";

const STATE_LABELS: Readonly<Record<string, string>> = {
  none: "Not asked for",
  requested: "Asked for",
  approved: "Signed off",
  rejected: "Changes asked for",
};

/** "JSY-SS-01 signed off, SHO-TR-01 not asked for", or the words that say the factory makes nothing yet. */
const goldenLine = (card: FactoryScorecard): string =>
  card.goldenSamples.length === 0
    ? "No article is on file for this factory."
    : card.goldenSamples.map((g) => `${g.articleCode}: ${STATE_LABELS[g.state] ?? g.state}`).join(" · ");

function Card({ card }: Readonly<{ card: FactoryScorecard }>) {
  return (
    <li className="rounded-2xl border border-hairline bg-surface p-4" data-testid="scorecard">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-ink">{card.name}</h3>
        <span
          data-testid="scorecard-state"
          className={`rounded-full px-2 py-0.5 text-sm font-medium ${card.isActive ? "bg-ok-wash text-ok" : "bg-warn-wash text-warn"}`}
        >
          {card.isActive ? "Active" : "Not active"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5">
        <div>
          <dt className="text-muted">On time</dt>
          <dd className="tabular-nums text-ink">{percent(card.onTime.rate)}</dd>
        </div>
        <div>
          <dt className="text-muted">Defects in the sample</dt>
          <dd className="tabular-nums text-ink">{percent(card.defects.rate)}</dd>
        </div>
        <div>
          <dt className="text-muted">Colour inside tolerance</dt>
          <dd className="tabular-nums text-ink">{percent(card.colour.rate)}</dd>
        </div>
        <div>
          <dt className="text-muted">Remakes open</dt>
          <dd className="tabular-nums text-ink">{card.remakes.open}</dd>
        </div>
        <div>
          <dt className="text-muted">Orders</dt>
          <dd className="tabular-nums text-ink">
            {card.orders} ({card.pieces} pieces)
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-ink-2">Golden samples: {goldenLine(card)}</p>
      {card.warnings.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-warn" data-testid="scorecard-warnings">
          {card.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">Nothing on file says anything is wrong with this factory.</p>
      )}
    </li>
  );
}

/** A card per factory. A failing factory is obvious: its state chip and its warnings are the loudest thing on it. */
export function ScorecardTable({ cards }: Readonly<{ cards: readonly FactoryScorecard[] }>) {
  if (cards.length === 0) {
    return (
      <p className="text-[15px] text-muted">
        No factory is on file yet. Add one at <span className="font-mono">/ops/factories</span>, and its card appears here as soon as it has an article.
      </p>
    );
  }
  return (
    <>
      <ul className="flex flex-col gap-4">
        {cards.map((card) => (
          <Card key={card.factoryProfileId} card={card} />
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">{NO_DEFECT_RATE_AGREED}</p>
    </>
  );
}
