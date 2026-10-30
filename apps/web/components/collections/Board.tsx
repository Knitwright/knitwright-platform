import type { CSSProperties, ReactNode } from "react";
import { countersText, groups } from "@/lib/collections/board";
import type { CollectionPlan } from "@/lib/collections/types";

type Props = Readonly<{
  plan: CollectionPlan;
  /** One card per style, by style id, so the page can stream each render in. */
  cards: Readonly<Record<string, ReactNode>>;
}>;

/** The dotted canvas, drawn here rather than in the shared stylesheet, which this workstream does not own. */
const DOTS: CSSProperties = {
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

/**
 * The collection board (spec F-S10): an infinite dotted canvas with the founder's own frames on it,
 * each frame showing Styles · Style-colourways · SKUs over the cards inside it.
 *
 * The canvas scrolls rather than panning with a mouse drag: a plan is read and changed on a phone as
 * well as a desktop, and a scrollable region works with a keyboard and a screen reader as it is.
 */
export function Board({ plan, cards }: Props) {
  const frames = groups(plan);
  return (
    <section aria-label={`The board of ${plan.name}`} style={DOTS} className="overflow-x-auto rounded-3xl border border-hairline p-4 sm:p-6">
      {frames.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-muted">No groups yet. Add a group, then put style cards in it.</p>
      ) : (
        <div className="flex min-w-max items-start gap-6">
          {frames.map((frame) => (
            <section
              key={frame.frameId ?? "loose"}
              aria-label={`${frame.name}, ${countersText(frame)}`}
              className="flex flex-col gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4"
            >
              <header className="flex flex-col gap-0.5">
                <h3 className="text-base font-medium text-ink">{frame.name}</h3>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted">{countersText(frame)}</p>
              </header>
              {frame.styleCards.length === 0 ? (
                <p className="w-60 text-[13px] text-faint">No styles in this group yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {frame.styleCards.map((style) => (
                    <li key={style.id}>{cards[style.id]}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
