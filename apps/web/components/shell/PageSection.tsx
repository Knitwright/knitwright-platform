import type { ReactNode } from "react";

type PageSectionProps = Readonly<{
  /** The id of the heading, which names the section for screen readers. */
  id: string;
  title: string;
  /** A short explanation shown under the heading. */
  description?: ReactNode;
  /** A warning section, such as deleting something, gets a warm edge. */
  tone?: "plain" | "warn";
  children?: ReactNode;
}>;

/**
 * One panel of a settings-style page. On a wide screen the heading and its explanation sit on
 * the left and the form on the right, so the page uses the full studio width without stretching
 * a form across it. On a phone they stack.
 */
export function PageSection({ id, title, description, tone = "plain", children }: PageSectionProps) {
  const edge = tone === "warn" ? "border-warn/40" : "border-hairline";
  return (
    <section
      aria-labelledby={id}
      className={`grid gap-x-10 gap-y-4 rounded-2xl border ${edge} bg-surface p-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:p-8`}
    >
      <div className="max-w-md">
        <h2 id={id} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {description ? <div className="mt-2 text-[15px] leading-relaxed text-muted">{description}</div> : null}
      </div>
      {children ? <div className="min-w-0 max-w-xl">{children}</div> : null}
    </section>
  );
}
