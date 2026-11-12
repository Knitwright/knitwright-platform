import { Plus, Shirt } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { CreateNew } from "@/components/studio/home/CreateNew";
import { buttonClasses } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Chips";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { COMING_LATER, hrefOf } from "@/lib/home/targets";
import { START_CARDS, type StartCard } from "@/lib/projects-page/start-cards";

/**
 * Recent's dashed start cards (d02): a large "Start a new design" with the create-new modal, then
 * four smaller cards in a two-by-two block. A card with no page yet says so, in words.
 */

const FRAME = "flex h-full flex-col gap-2 rounded-xl border border-dashed border-border-strong bg-bg p-5.5";

function FirstCard({ card }: Readonly<{ card: StartCard }>) {
  return (
    <div className={cx(FRAME, "gap-3 lg:row-span-2")}>
      <h2 className="text-h1 text-text">{card.title}</h2>
      <p className="text-body text-text-2">{card.text}</p>
      <div className="grid flex-1 grid-cols-2 items-center gap-4 py-4">
        {[["Base product", "neutral"], ["Template", "beta"]].map(([label, tone]) => (
          <span key={label} className="flex flex-col items-center gap-3">
            <Tag tone={tone as "neutral" | "beta"}>{label}</Tag>
            <Icon icon={Shirt} size={22} className={cx("size-24 stroke-1", tone === "beta" ? "fill-navy text-gold" : "text-muted-2")} />
          </span>
        ))}
      </div>
      <CreateNew label="Start designing" className={buttonClasses("primary", false, "self-start")} />
    </div>
  );
}

function SmallCard({ card }: Readonly<{ card: StartCard }>) {
  const href = hrefOf(card.target);
  const body = (
    <>
      <h2 className="text-h2 text-text">{card.title}</h2>
      <p className="max-w-64 text-body text-text-2">{card.text}</p>
      {href ? (
        <span className="mt-auto grid size-8 place-items-center rounded-full border border-border text-text-2" aria-hidden="true">
          <Icon icon={Plus} size={16} />
        </span>
      ) : (
        <span className="mt-auto text-small text-muted">{COMING_LATER}</span>
      )}
    </>
  );
  return href ? (
    <Link href={href as Route} className={cx(FRAME, "no-underline transition-colors duration-fast hover:bg-soft")}>
      {body}
    </Link>
  ) : (
    <div className={FRAME}>{body}</div>
  );
}

export function StartCards() {
  const [first, ...rest] = START_CARDS;
  return (
    <section aria-label="Start here" className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[repeat(2,minmax(13rem,auto))]">
      <FirstCard card={first!} />
      {rest.map((card) => (
        <SmallCard key={card.id} card={card} />
      ))}
    </section>
  );
}
