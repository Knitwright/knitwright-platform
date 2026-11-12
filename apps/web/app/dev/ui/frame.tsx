import type { ReactNode } from "react";

/** A section of the gallery: an h2 and its rows. */
export function Section({ id, title, children }: Readonly<{ id: string; title: string; children: ReactNode }>) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-6 flex-col gap-6 border-t border-border pt-8">
      <h2 id={`${id}-title`} className="text-h2 text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** One row of examples with a caption saying which state they show. */
export function Row({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="overline text-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** A grey stand-in for a picture: the gallery shows no artwork. */
export function Placeholder({ label }: Readonly<{ label: string }>) {
  return (
    <span aria-hidden="true" className="grid size-full place-items-center text-caption text-muted">
      {label}
    </span>
  );
}
