import type { Route } from "next";
import Link from "next/link";
import { ACTION_CARDS, type HomeCard } from "@/lib/home/cards";
import { COMING_LATER, hrefOf } from "@/lib/home/targets";
import { CreateNew } from "./CreateNew";

/**
 * The action cards of the studio home (spec F-S4, "Body"). The first opens the create-new modal;
 * the rest open a page, or say "Coming in a later release" where their feature is not built.
 */

const CARD = "glass flex h-full flex-col gap-2 rounded-[1.6rem] p-5";

function Card({ card }: Readonly<{ card: HomeCard }>) {
  const href = hrefOf(card.target);

  if (card.target.kind === "new-design") {
    return (
      <div className={`${CARD} thread-ring`}>
        <h3 className="text-[16.5px] font-medium tracking-[-0.01em] text-ink">{card.title}</h3>
        <p className="text-[13.5px] leading-relaxed text-ink-2">{card.text}</p>
        <div className="mt-auto pt-3">
          <CreateNew label="+ Start designing" />
        </div>
      </div>
    );
  }

  if (href === null) {
    return (
      <div className={CARD}>
        <h3 className="text-[16.5px] font-medium tracking-[-0.01em] text-ink-2">{card.title}</h3>
        <p className="text-[13.5px] leading-relaxed text-muted">{card.text}</p>
        <p className="mt-auto pt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">{COMING_LATER}</p>
      </div>
    );
  }

  return (
    <Link href={href as Route} className={`${CARD} lift text-ink no-underline`}>
      <span className="fill-layer" aria-hidden="true" />
      <h3 className="text-[16.5px] font-medium tracking-[-0.01em]">{card.title}</h3>
      <p className="text-[13.5px] leading-relaxed text-ink-2">{card.text}</p>
    </Link>
  );
}

export function ActionCards() {
  return (
    <section aria-labelledby="start-here" className="flex flex-col gap-3">
      <h2 id="start-here" className="text-xl font-medium tracking-[-0.02em] text-ink">
        Start here
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ACTION_CARDS.map((card) => (
          <li key={card.id}>
            <Card card={card} />
          </li>
        ))}
      </ul>
    </section>
  );
}
