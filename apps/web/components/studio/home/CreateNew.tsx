"use client";

import { ChevronRight, Shirt } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useId, useState } from "react";
import { BodyPortal } from "@/components/garment-studio/BodyPortal";
import { Tag } from "@/components/ui/Chips";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { CREATE_GROUPS, waysOf, type HomeCard } from "@/lib/home/cards";
import { COMING_LATER, hrefOf } from "@/lib/home/targets";
import { newButtonProps } from "./create-new-a11y";

/**
 * "Create a new design" (`08` v3.6, `09` screen 28, prototype d20; decisions 0074 and 0150): the
 * Knitwright library (Products, Templates) and Start your own (Kit from your crest, Import your own
 * pattern), each a row with a thumbnail and a ›. There is no blank canvas: every design starts from a
 * block a factory can make, and `lib/home/cards.test.ts` holds that rule.
 *
 * It is the design system's modal, drawn into the body: Esc or × closes it and gives focus back to the
 * button, and Tab goes round inside it.
 */
export function CreateNew({ label = "+ New", className }: Readonly<{ label?: string; className?: string }>) {
  const dialogId = useId();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        {...newButtonProps({ dialogId, titleId }, open)}
        onClick={() => setOpen(true)}
        className={className ?? "inline-flex min-h-10 w-full items-center justify-center rounded-md border border-border bg-bg px-4 text-body font-semibold text-text live:hover:bg-soft"}
      >
        {label}
      </button>
      <BodyPortal>
        <Modal open={open} onClose={() => setOpen(false)} title="Create a new design" size="md">
          <div id={dialogId} className="flex flex-col gap-6">
            {CREATE_GROUPS.map((group) => (
              <section key={group.label} aria-label={group.label} className="flex flex-col gap-2.5">
                <h3 className="text-small font-medium text-muted">{group.label}</h3>
                <ul className="flex flex-col gap-2.5">
                  {waysOf(group).map((way) => (
                    <li key={way.id}>
                      <WayRow way={way} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Modal>
      </BodyPortal>
    </>
  );
}

const ROW = "flex min-h-21 items-center gap-6 rounded-xl border border-border px-6 py-4";

/** One way in: a row with its thumbnail, title, line and ›. A way with nothing behind it yet says so and is not a link. */
function WayRow({ way }: Readonly<{ way: HomeCard }>) {
  const href = hrefOf(way.target);
  const body = (
    <>
      <Icon icon={Shirt} size={22} className="size-10 shrink-0 stroke-1 text-muted-2" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-title text-text">
          {way.title}
          {way.tag ? <Tag tone="beta">{way.tag}</Tag> : null}
        </span>
        <span className="text-body text-muted">{way.text}</span>
        {href === null ? <span className="text-caption text-muted">{COMING_LATER}</span> : null}
      </span>
      {href === null ? null : <Icon icon={ChevronRight} size={20} className="text-text-2" />}
    </>
  );
  if (href === null) return <div className={ROW}>{body}</div>;
  return (
    <Link href={href as Route} className={cx(ROW, "no-underline transition-colors duration-fast live:hover:bg-soft")}>
      {body}
    </Link>
  );
}
