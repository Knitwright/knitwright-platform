import type { ReactNode } from "react";

type PageIntroProps = Readonly<{
  /** The small line above the heading, such as the brand name. */
  eyebrow: string;
  title: string;
  lead?: ReactNode;
}>;

/** The eyebrow, heading and opening line of a studio page, held to a comfortable line length. */
export function PageIntro({ eyebrow, title, lead }: PageIntroProps) {
  return (
    <header className="max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-wider text-muted">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      {lead ? <p className="mt-3 text-[15px] leading-relaxed text-muted">{lead}</p> : null}
    </header>
  );
}

type FormPageProps = PageIntroProps & Readonly<{ children: ReactNode }>;

/**
 * A page that is mostly one form. On a wide screen the introduction stays on the left and the
 * form takes the rest of the studio width, so the page does not sit in a narrow strip. On a
 * phone they stack.
 */
export function FormPage({ children, ...intro }: FormPageProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <PageIntro {...intro} />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
