"use client";

import { Briefcase } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { UpgradeButton } from "@/components/plans/UpgradeButton";
import { isCanvas } from "@/lib/shell/help";
import { brandIsCurrent, type Workspace } from "@/lib/shell/nav";
import { PhoneMenu } from "./PhoneMenu";
import { TOP_SLOT_ID } from "./TopBarSlot";
import { AccountMenu, AddMenu } from "./TopBarMenus";

/**
 * The 76 px top bar (10 §4; 09 "Global shell"): the brand pill on the left, the page's tabs in the
 * centre (`TopBarSlot`), ⊕, Upgrade and the avatar on the right. Below `md` the rail is hidden and
 * the bar starts with the Menu that holds every place.
 */

export type TopBarProps = Readonly<{
  email: string | null;
  brandName: string;
  workspace: Workspace;
  credits: number | null;
  helpHref: string;
}>;

export function TopBar(props: TopBarProps) {
  const path = usePathname();
  return <TopBarView path={path} {...props} />;
}

/** The bar for a given address. Apart from `TopBar` so it can be drawn with no router. */
export function TopBarView({ path, email, brandName, workspace, credits, helpHref }: TopBarProps & Readonly<{ path: string }>) {
  return (
    <header className="flex h-19 shrink-0 items-center gap-4 px-4 md:pr-9 md:pl-10">
      <PhoneMenu path={path} workspace={workspace} helpHref={helpHref} className={isCanvas(path) ? undefined : "md:hidden"} />
      <BrandPill name={brandName} isNew={!workspace.setUp} current={brandIsCurrent(path)} />
      <div id={TOP_SLOT_ID} className="flex min-w-0 flex-1 justify-center max-md:hidden" />
      <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-4">
        <AddMenu credits={credits} />
        {/* Upgrade opens Choose Your Plan (decision 0144), which the shell mounts once. */}
        <UpgradeButton />
        <AccountMenu email={email} />
      </div>
    </header>
  );
}

type BrandPillProps = Readonly<{ name: string; isNew: boolean; current: boolean }>;

/** The brand pill: a briefcase, the brand's name, and a gold "New" until the brand is set up. Opens the Brand page (decision 0144). */
function BrandPill({ name, isNew, current }: BrandPillProps) {
  return (
    <Link
      href="/brand"
      aria-current={current ? "page" : undefined}
      className="group flex min-h-10 min-w-0 items-center gap-2.5 rounded-lg text-title text-muted no-underline live:hover:text-text"
    >
      <span className={cx("grid size-10 shrink-0 place-items-center rounded-md", current ? "bg-soft-2 text-text" : "bg-soft")}>
        <Icon icon={Briefcase} />
      </span>
      <span className="sr-only">
        Brand: {name}.{isNew ? " New, not set up yet." : ""} Open Brand.
      </span>
      <span aria-hidden="true" data-testid="active-brand" className="truncate">
        {name}
      </span>
      {isNew ? (
        <span aria-hidden="true" data-testid="brand-new" className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-caption font-bold text-navy">
          New
        </span>
      ) : null}
    </Link>
  );
}
