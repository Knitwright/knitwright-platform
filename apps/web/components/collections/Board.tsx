import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { countersText, groups } from "@/lib/collections/board";
import type { CollectionPlan } from "@/lib/collections/types";
import { styleWord } from "@/lib/collections/vocabulary";

type Props = Readonly<{
  plan: CollectionPlan;
  /** One card per style, by style id, so the page can stream each render in. */
  cards: Readonly<Record<string, ReactNode>>;
  /** Owners, admins and kit managers see "+ Add style" at the foot of every column. */
  canEdit: boolean;
}>;

/**
 * The range plan board (09 screen 32, p13; 08 v3.7 "Fabra-like"): one column per drop or group, its
 * name and count on top, its style cards below, and "+ Add style" at the foot, which goes to the
 * add-a-style form under the board. Each column is a region named with its counters (spec F-S10).
 */
export function Board({ plan, cards, canEdit }: Props) {
  const columns = groups(plan);
  return (
    <section aria-label={`The board of ${plan.name}`} className="overflow-x-auto">
      {columns.length === 0 ? (
        <p className="py-10 text-center text-body text-muted">No groups yet. Add a group, then put style cards in it.</p>
      ) : (
        <div className="grid auto-cols-[minmax(16rem,1fr)] grid-flow-col gap-5">
          {columns.map((column) => (
            <section key={column.frameId ?? "loose"} aria-label={`${column.name}, ${countersText(column)}`} className="flex flex-col gap-3">
              <header className="flex items-baseline justify-between gap-2">
                <h3 className="text-title text-text">{column.name}</h3>
                <p className="text-body text-muted" title={countersText(column)}>
                  {styleWord(column.styles)}
                </p>
              </header>
              <ul className="flex flex-col gap-4">
                {column.styleCards.map((style) => (
                  <li key={style.id}>{cards[style.id]}</li>
                ))}
                {canEdit ? (
                  <li>
                    <a
                      href="#add-style"
                      className="grid h-16 place-items-center rounded-xl border border-dashed border-border-strong text-muted no-underline transition-colors duration-fast live:hover:bg-soft"
                    >
                      <Icon icon={Plus} size={20} />
                      <span className="sr-only">Add style to {column.name}</span>
                    </a>
                  </li>
                ) : null}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
