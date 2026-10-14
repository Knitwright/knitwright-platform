import type { ReactNode } from "react";

/** The accuracy limits, always on screen beside a reading. The sentences come from the server with the reading. */
export function Limits({ limits, children }: Readonly<{ limits: readonly string[]; children?: ReactNode }>) {
  return (
    <section aria-label="What a close reading cannot do" className="rounded-2xl border border-hairline bg-surface p-4 text-sm leading-relaxed text-ink-2" data-testid="design-import-limits">
      <h3 className="mb-2 text-[15px] font-medium text-ink">What a close reading cannot do</h3>
      <ul className="list-disc space-y-1 pl-5">
        {limits.map((limit) => (
          <li key={limit}>{limit}</li>
        ))}
      </ul>
      {children}
    </section>
  );
}
