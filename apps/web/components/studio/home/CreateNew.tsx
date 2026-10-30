"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CREATE_GROUPS, waysOf } from "@/lib/home/cards";
import { COMING_LATER, hrefOf } from "@/lib/home/targets";
import { trapTarget } from "@/lib/workspace/focus-trap";
import { FOCUSABLE, modalProps, newButtonProps } from "./create-new-a11y";

/**
 * "+ New" and the create-new modal (spec F-S4). It offers Base products, Templates, From your crest
 * or logo and Your team. There is no blank canvas: a custom pattern goes through the pattern service
 * request (plan v5 Y1), and `lib/home/actions.test.ts` holds that rule.
 *
 * Escape or Close closes it and gives focus back to the button; Tab goes round inside it.
 */
export function CreateNew({ label = "+ New", className }: Readonly<{ label?: string; className?: string }>) {
  const dialogId = useId();
  const titleId = useId();
  const ids = { dialogId, titleId };
  const button = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) title.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((control) => control.offsetParent !== null);
    const target = trapTarget(controls.length, controls.indexOf(document.activeElement as HTMLElement), event.shiftKey);
    if (target === null) return;
    event.preventDefault();
    controls[target]?.focus();
  };

  return (
    <>
      <button
        ref={button}
        {...newButtonProps(ids, open)}
        onClick={() => setOpen(true)}
        className={className ?? "chip-btn inline-flex min-h-10 w-full items-center justify-center rounded-full border border-white/20 bg-white/[0.06] px-4 text-[15px] font-medium text-ink"}
      >
        {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
          <div {...modalProps(ids)} onKeyDown={keys} className="glass-strong flex w-full max-w-2xl flex-col gap-5 rounded-[2rem] p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <h2 id={titleId} ref={title} tabIndex={-1} className="flex-1 text-2xl font-medium tracking-[-0.02em] text-ink outline-none">
                Create a new design
              </h2>
              <button type="button" onClick={close} className="chip-btn inline-flex min-h-10 items-center rounded-full border border-white/20 px-4 text-sm font-medium text-ink">
                Close
              </button>
            </div>
            {CREATE_GROUPS.map((group) => (
              <section key={group.label} aria-label={group.label} className="flex flex-col gap-2">
                <h3 className="font-mono text-xs uppercase tracking-[0.1em] text-muted">{group.label}</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {waysOf(group).map((way) => (
                    <li key={way.id}>
                      <WayTile way={way} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="text-[13px] text-muted">
              There is no blank canvas. A pattern Knitwright has no base for goes through a pattern service request, so
              every design starts from a block a factory can make.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

const TILE = "flex h-full flex-col gap-1.5 rounded-[1.4rem] border border-white/12 bg-white/[0.04] p-4";

/** One way into a new design. A way with nothing behind it yet says so and is not a link. */
function WayTile({ way }: Readonly<{ way: ReturnType<typeof waysOf>[number] }>) {
  const href = hrefOf(way.target);
  if (href === null) {
    return (
      <div className={TILE}>
        <span className="text-[15px] font-medium text-ink-2">{way.title}</span>
        <span className="text-[13px] text-muted">{way.text}</span>
        <span className="mt-auto pt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">{COMING_LATER}</span>
      </div>
    );
  }
  return (
    <Link href={href as Route} className={`${TILE} lift text-ink no-underline`}>
      <span className="text-[15px] font-medium">{way.title}</span>
      <span className="text-[13px] text-ink-2">{way.text}</span>
    </Link>
  );
}
