import type { Route } from "next";
import Link from "next/link";
import { cx } from "@/components/ui/cx";

type Props = Readonly<{ collectionId: string; view: "board" | "list" }>;

/**
 * List or Board (08 v3.7 "a List / Board toggle on Orders → Range plan"), drawn as 10 §8's segmented
 * control. Each view is its own address, so the segments are links.
 */
export function ViewToggle({ collectionId, view }: Props) {
  const views = [
    { id: "list" as const, label: "List", href: `/orders/plan/${collectionId}?view=list` },
    { id: "board" as const, label: "Board", href: `/orders/plan/${collectionId}` },
  ];
  return (
    <nav aria-label="How to see this plan" className="inline-flex items-center gap-0.5 rounded-md bg-soft p-1">
      {views.map((one) => (
        <Link
          key={one.id}
          href={one.href as Route}
          aria-current={view === one.id ? "page" : undefined}
          className={cx(
            "flex h-8 items-center rounded-sm px-6 text-small font-medium no-underline transition-colors duration-fast",
            view === one.id ? "bg-bg text-text shadow-e1" : "text-text-2 live:hover:text-text",
          )}
        >
          {one.label}
        </Link>
      ))}
    </nav>
  );
}
