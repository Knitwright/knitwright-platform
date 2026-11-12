import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/**
 * A Settings card (d19): white, 1 px border, r-2xl; a 17/600 title, a one-line summary, and an action.
 * Cards sit three to a row on a wide screen.
 */
export function SettingsCard({
  title,
  summary,
  children,
  href,
}: Readonly<{ title: string; summary: ReactNode; children?: ReactNode; href?: string }>) {
  return (
    <section className="flex min-h-32 flex-col gap-2 rounded-2xl border border-border bg-bg p-5">
      <h2 className="text-title text-text">{href ? <a href={href} className="no-underline live:hover:underline">{title}</a> : title}</h2>
      <p className="text-body text-text-2">{summary}</p>
      {children ? <div className="mt-auto flex flex-wrap gap-2 pt-2">{children}</div> : null}
    </section>
  );
}

/** A full-width part of Settings under the cards, with its own heading for its anchor. */
export function SettingsPart({
  id,
  title,
  lead,
  tone = "plain",
  children,
}: Readonly<{ id: string; title: string; lead?: ReactNode; tone?: "plain" | "warn"; children: ReactNode }>) {
  return (
    <section
      aria-labelledby={id}
      className={cx(
        "grid scroll-mt-24 gap-x-10 gap-y-4 rounded-2xl border bg-bg p-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
        tone === "warn" ? "border-warn-soft" : "border-border",
      )}
    >
      <div className="max-w-md">
        <h2 id={id} className="text-title text-text">
          {title}
        </h2>
        {lead ? <div className="mt-2 text-body text-muted">{lead}</div> : null}
      </div>
      <div className="min-w-0 max-w-xl">{children}</div>
    </section>
  );
}
