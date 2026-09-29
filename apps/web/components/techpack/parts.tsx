import type { ReactNode } from "react";
import { cellView, classView, toleranceView, type CellTone, type CellView } from "@/lib/projects/tech-pack-view";
import type { Cell, ClassCell, LengthValue } from "@/lib/techpack";

/*
 * Small pieces the tech pack page is built from. They hold markup only. What a value says,
 * and where it came from, is worked out in lib/projects/tech-pack-view.
 */

const TONES: Readonly<Record<CellTone, string>> = {
  person: "text-ink",
  derived: "text-muted",
  suggested: "rounded-md bg-warn-wash px-2 py-0.5 text-warn",
  // A missing value must be seen: it uses the attention colours.
  missing: "rounded-md bg-warn-wash px-2 py-0.5 font-medium text-warn",
};

export function Value({ view }: Readonly<{ view: CellView }>) {
  return (
    <span data-tone={view.tone} className="inline-flex flex-col items-start gap-0.5">
      <span className={`text-[15px] ${TONES[view.tone]}`}>{view.text}</span>
      {view.source ? <span className="text-xs text-muted">{view.source}</span> : null}
    </span>
  );
}

export const CellText = ({ cell, unit }: Readonly<{ cell: Cell; unit?: string }>) => (
  <Value view={cellView(cell, unit)} />
);

export const LengthText = ({ cell }: Readonly<{ cell: LengthValue }>) => <Value view={cellView(cell, "cm")} />;

export const ToleranceText = ({ cell }: Readonly<{ cell: LengthValue }>) => <Value view={toleranceView(cell)} />;

export function ClassText({ cell }: Readonly<{ cell: ClassCell }>) {
  const view = classView(cell);
  return (
    <span data-tone={view.tone} className="inline-flex flex-col items-start gap-0.5">
      <span className="text-[15px] text-ink">
        {view.text}, <span className="font-mono text-sm">{view.iso}</span>
      </span>
      <span className="text-xs text-muted">{view.source}</span>
      <span className="max-w-64 text-xs text-muted">{view.explanation}</span>
    </span>
  );
}

type DocSectionProps = Readonly<{ id: string; title: string; note: string | null; children: ReactNode }>;

/** A section of the document, with its heading, a line saying what is missing, and its content. */
export function DocSection({ id, title, note, children }: DocSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 rounded-2xl border border-hairline bg-surface p-6">
      <h2 id={`${id}-title`} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      {note ? <p className="mt-2 text-[15px] leading-relaxed text-muted">{note}</p> : null}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

type TableProps = Readonly<{ caption: string; heads: readonly string[]; children: ReactNode }>;

/** A table with a hidden caption and column heads. It scrolls sideways when it is wide. */
export function DocTable({ caption, heads, children }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left align-top">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-hairline text-sm text-muted">
            {heads.map((head) => (
              <th key={head} scope="col" className="px-3 py-2 font-medium">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">{children}</tbody>
      </table>
    </div>
  );
}

export const Cellular = ({ children }: Readonly<{ children: ReactNode }>) => (
  <td className="px-3 py-2 align-top text-ink-2">{children}</td>
);

export const RowHead = ({ children }: Readonly<{ children: ReactNode }>) => (
  <th scope="row" className="px-3 py-2 text-left align-top font-medium text-ink">
    {children}
  </th>
);
