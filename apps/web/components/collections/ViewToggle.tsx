import type { Route } from "next";
import Link from "next/link";

type Props = Readonly<{ collectionId: string; view: "board" | "line-plan" }>;

const CHIP = "rounded-full px-4 py-2 text-[14px] transition-colors";

/** Board or line plan, from the top centre of the screen as spec F-S10 puts it. */
export function ViewToggle({ collectionId, view }: Props) {
  const views = [
    { id: "board" as const, label: "Board", href: `/studio/collections/${collectionId}` },
    { id: "line-plan" as const, label: "Line plan", href: `/studio/collections/${collectionId}?view=line-plan` },
  ];
  return (
    <nav aria-label="How to see this plan" className="inline-flex gap-1 rounded-full border border-hairline bg-surface p-1">
      {views.map((one) => (
        <Link
          key={one.id}
          href={one.href as Route}
          aria-current={view === one.id ? "page" : undefined}
          className={`${CHIP} ${view === one.id ? "bg-white/10 text-ink" : "text-muted hover:text-ink"}`}
        >
          {one.label}
        </Link>
      ))}
    </nav>
  );
}
