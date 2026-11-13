"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Chips";
import { Modal } from "@/components/ui/Modal";
import { COMING_SOON, WORKS_WELL, rememberWelcome, shouldWelcome } from "@/lib/garment-studio/welcome";

/** The browser's stores, or null where there are none (the server, a blocked origin). */
const stores = (): { local: Storage | null; session: Storage | null } => {
  try {
    return { local: window.localStorage, session: window.sessionStorage };
  } catch {
    return { local: null, session: null };
  }
};

/**
 * THE BETA WELCOME (plan v6 G1, decision 0150; `08` v3.6, s01): on first open, a BETA tag, what works
 * well (dashed) and what is coming (grey), "Don't show this again" and Start designing. It is decided
 * after the page has hydrated, from the browser's own storage, so the server never draws it and a
 * browser that cannot remember never sees it more than once a visit.
 *
 * `forceOpen` is for the /dev fixture only.
 */
export function WelcomeModal({ forceOpen = false }: Readonly<{ forceOpen?: boolean }>) {
  const [open, setOpen] = useState(forceOpen);
  const [forGood, setForGood] = useState(true);
  const checkId = useId();

  useEffect(() => {
    if (forceOpen) return;
    const { local, session } = stores();
    // Read once, after hydration: the server cannot know what this browser remembers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (shouldWelcome(local, session)) setOpen(true);
  }, [forceOpen]);

  const close = () => {
    const { local, session } = stores();
    rememberWelcome(local, session, forGood);
    setOpen(false);
  };

  return (
    <Modal open={open} onClose={close} title="Welcome to Garment Studio" size="lg">
      <div className="flex flex-col gap-6" data-testid="studio-welcome">
        <Tag tone="beta" className="self-start">
          BETA
        </Tag>
        <p className="text-body-lg font-normal text-muted">
          Change fabrics, colours, prints and trims and preview your kit in 3D, all in one place. We&apos;re still in beta, so here&apos;s what to expect.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <List title="Works well" items={WORKS_WELL} className="border border-dashed border-border-strong" />
          <List title="Coming soon" items={COMING_SOON} className="bg-soft" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-body text-muted">
            <input id={checkId} type="checkbox" checked={forGood} onChange={(event) => setForGood(event.target.checked)} className="size-5 accent-navy" />
            <label htmlFor={checkId}>Don&apos;t show this again</label>
          </span>
          <Button size="lg" onClick={close} data-primary>
            Start designing
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function List({ title, items, className }: Readonly<{ title: string; items: readonly string[]; className: string }>) {
  return (
    <section aria-label={title} className={`flex flex-col gap-2 rounded-xl p-5.5 ${className}`}>
      <h3 className="text-body font-semibold text-text">{title}</h3>
      <ul className="flex flex-col gap-1.5 text-body text-text-2">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
