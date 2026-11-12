import type { Route } from "next";
import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/PageStates";
import { Icon } from "@/components/ui/Icon";
import type { IconKey } from "@/lib/shell/nav";
import { ICONS } from "./icons";
import { TopBarTabs, TopBarTitle, type TopBarTab } from "./TopBarSlot";

/**
 * A v3.9 route whose page a later workstream builds (decision 0138). It has its title in the top bar
 * and U1's Empty state (10 §9), saying what is coming and, where something already does part of the
 * job, one action that opens it. It promises nothing it cannot open.
 */

type PlaceholderProps = Readonly<{
  title: string;
  icon: IconKey;
  /** The Empty state's title, such as "AI Studio is on its way". */
  heading: string;
  children: ReactNode;
  action?: Readonly<{ href: Route; label: string }>;
  /** The area's tabs. When given they take the bar's centre in place of the title. */
  tabs?: Readonly<{ label: string; items: readonly TopBarTab[] }>;
}>;

export function PlaceholderPage({ title, icon, heading, children, action, tabs }: PlaceholderProps) {
  return (
    <>
      {tabs ? <TopBarTabs label={tabs.label} tabs={tabs.items} /> : <TopBarTitle>{title}</TopBarTitle>}
      <h1 className="pt-4 text-h2 text-text md:sr-only">{title}</h1>
      <EmptyState
        icon={<Icon icon={ICONS[icon]} size={22} />}
        title={heading}
        action={action ? <LinkButton href={action.href}>{action.label}</LinkButton> : undefined}
        className="mt-16"
      >
        {children}
      </EmptyState>
    </>
  );
}
