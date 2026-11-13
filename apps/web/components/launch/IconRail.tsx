"use client";

import { CircleHelp, CloudUpload, GraduationCap, Grip, ImagePlus, Layers, LayoutPanelLeft, Package, Shapes, Shirt, Type, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { entryFor, FLYOUT_ID, RAIL_ENTRIES, railMove, railTab, type Flyout, type RailEntryId } from "@/lib/editor-chrome";

type Props = Readonly<{
  flyout: Flyout;
  /** Words under the icons (≡ › Menu labels). On by default, as in the reference. */
  labels: boolean;
  onPress: (id: RailEntryId) => void;
  /** The ≡ main menu, drawn under the logo. */
  menu: ReactNode;
}>;

const ICONS: Readonly<Record<RailEntryId, LucideIcon>> = {
  products: Package,
  templates: LayoutPanelLeft,
  text: Type,
  illustrations: Shapes,
  gallery: ImagePlus,
  mockups: Shirt,
  uploads: CloudUpload,
  more: Grip,
  learn: GraduationCap,
  layers: Layers,
  help: CircleHelp,
};

/**
 * THE EDITOR'S LEFT RAIL (plan v6 E2, decision 0146; `08` §5.1, prototype e01): the KW logo back to
 * the dashboard, the ≡ menu, then the eleven labelled items of `lib/editor-chrome/rail.ts`, with a
 * hairline after Uploads and Help at the foot.
 *
 * A tab list, as the launch rail was: the arrow keys move between items and open each one, Home and
 * End jump to the ends, and Tab moves on into the open flyout. Pressing the lit item closes the
 * flyout, so no item is selected while it is closed.
 */
export function IconRail({ flyout, labels, onPress, menu }: Props) {
  const tabs = useRef(new Map<RailEntryId, HTMLButtonElement>());
  const lit = entryFor(flyout);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = (event.target as HTMLElement).dataset["rail"] as RailEntryId | undefined;
    const target = from ? railMove(from, event.key) : null;
    if (!target) return;
    event.preventDefault();
    if (target !== lit) onPress(target);
    tabs.current.get(target)?.focus();
  };

  const item = (id: RailEntryId, label: string) => {
    const selected = id === lit;
    return (
      <button
        key={id}
        ref={(element) => {
          if (element) tabs.current.set(id, element);
          else tabs.current.delete(id);
        }}
        id={railTab(id)}
        type="button"
        role="tab"
        data-rail={id}
        aria-selected={selected}
        aria-controls={selected ? FLYOUT_ID : undefined}
        aria-label={labels ? undefined : label}
        tabIndex={selected || (lit === null && id === "products") ? 0 : -1}
        onClick={() => onPress(id)}
        className={cx("group flex w-18 shrink-0 flex-col items-center gap-1 text-micro tracking-normal", selected ? "font-semibold text-text" : "font-medium text-text-2")}
      >
        <span
          className={cx(
            "grid size-10.5 place-items-center rounded-md border transition-colors duration-fast",
            selected ? "border-electric/40 bg-electric-soft text-navy" : "border-transparent text-text-2 group-hover:bg-soft",
          )}
        >
          <Icon icon={ICONS[id]} />
        </span>
        {labels ? <span>{label}</span> : null}
      </button>
    );
  };

  const group = (name: string) => RAIL_ENTRIES.filter((entry) => entry.group === name).map((entry) => item(entry.id, entry.label));

  return (
    <nav
      aria-label="Editor"
      data-testid="launch-rail"
      className={cx(
        "z-40 flex shrink-0 items-center gap-1.5 bg-bg [scrollbar-width:none]",
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:w-full max-lg:flex-row max-lg:overflow-x-auto max-lg:border-t max-lg:border-border max-lg:px-2 max-lg:py-1.5",
        "lg:h-full lg:flex-col lg:overflow-y-auto lg:border-r lg:border-border lg:py-3",
        labels ? "lg:w-19" : "lg:w-15",
      )}
    >
      <Link
        href="/ai-studio"
        aria-label="Back to the dashboard"
        className="grid size-9 shrink-0 place-items-center rounded-md bg-navy text-caption font-black text-gold no-underline"
        data-testid="editor-home"
      >
        KW
      </Link>
      {menu}
      <span aria-hidden="true" className="my-0.5 h-px w-10 shrink-0 bg-border" />
      <div role="tablist" aria-label="Panels" aria-orientation="vertical" onKeyDown={move} className="flex min-h-0 flex-1 items-center gap-1.5 max-lg:flex-row lg:flex-col">
        {group("make")}
        <span aria-hidden="true" className="my-0.5 h-px w-10 shrink-0 bg-border" />
        {group("find")}
        <span aria-hidden="true" className="mt-auto" />
        {group("foot")}
      </div>
    </nav>
  );
}
