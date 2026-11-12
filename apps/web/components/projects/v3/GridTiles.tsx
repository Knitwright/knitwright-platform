import { Megaphone, Plus, Shirt, Store } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { ProjectCard } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

/** The grid every Projects list is drawn in: five across at 1440, as d01. */
export const GRID = "grid grid-cols-1 gap-x-5.5 gap-y-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5";

/** The dashed "New" card at the start of the grid (d01). It starts a design the way Create does. */
export function NewTile({ href = "/studio/start" as Route, label = "New" }: Readonly<{ href?: Route; label?: string }>) {
  return (
    <li className="min-w-0">
      <Link
        href={href}
        className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-title font-medium text-text-2 no-underline transition-colors duration-fast hover:bg-soft"
      >
        <Icon icon={Plus} size={22} />
        {label}
        <span className="sr-only"> project</span>
      </Link>
    </li>
  );
}

/**
 * The guide cards after the projects (d01's tutorial cards). Each opens the page it is about; the
 * words are ours.
 */
const GUIDES: readonly { title: string; href: Route; icon: typeof Shirt }[] = [
  { title: "Design a club kit, start to finish", href: "/studio/start" as Route, icon: Shirt },
  { title: "Make product pictures for your shop", href: "/mockups" as Route, icon: Store },
  { title: "Launch a kit with ads and posts", href: "/marketing" as Route, icon: Megaphone },
];

function GuideArt({ title, icon }: Readonly<{ title: string; icon: typeof Shirt }>) {
  return (
    <span className="grid h-5/6 w-1/2 min-w-28 grid-rows-[auto_1fr] gap-2 rounded-md bg-navy p-3 text-left text-on-dark">
      <span className="text-micro uppercase text-gold">Guide</span>
      <span className="text-small font-bold leading-tight uppercase">{title}</span>
      <Icon icon={icon} size={22} className="justify-self-center text-gold" />
    </span>
  );
}

export function GuideTiles() {
  return (
    <>
      {GUIDES.map((guide) => (
        <li key={guide.title} className="min-w-0" data-testid="guide-tile">
          <ProjectCard title={guide.title} meta="Guide" href={guide.href} thumb={<GuideArt title={guide.title} icon={guide.icon} />} />
        </li>
      ))}
    </>
  );
}
