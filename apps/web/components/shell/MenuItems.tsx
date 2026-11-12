"use client";

import { LogOut } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { useFormAction } from "@/components/forms/useFormAction";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { signOutAction } from "@/lib/auth/actions";
import type { IconKey } from "@/lib/shell/nav";
import { ICONS } from "./icons";

/** A menu row (10 §8): 40 px, r-md, 15/500 `text-2`, a 20 px icon; hover and focus `soft`. */
export const MENU_ROW =
  "flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-body-lg font-medium whitespace-nowrap text-text-2 no-underline transition-colors duration-fast ease-out live:hover:bg-soft focus-visible:bg-soft focus-visible:outline-none";

type MenuItemLinkProps = Readonly<{
  href: Route | string;
  icon: IconKey;
  children: ReactNode;
  current?: boolean;
  /** What follows the label at the far right, such as a count. */
  trailing?: ReactNode;
  testId?: string;
}>;

/** An entry that opens a page. A `mailto:` address is a plain anchor, every other one a `Link`. */
export function MenuItemLink({ href, icon, children, current = false, trailing, testId }: MenuItemLinkProps) {
  const inner = (
    <>
      <Icon icon={ICONS[icon]} />
      <span className="flex-1">{children}</span>
      {trailing}
    </>
  );
  const shared = {
    role: "menuitem",
    tabIndex: -1,
    "aria-current": current ? ("page" as const) : undefined,
    "data-testid": testId,
    className: cx(MENU_ROW, current && "bg-soft-2 text-text"),
  };
  if (href.startsWith("mailto:")) return <a href={href} {...shared}>{inner}</a>;
  return (
    <Link href={href as Route} {...shared}>
      {inner}
    </Link>
  );
}

/** Sign out, as an entry of the avatar menu. The same server action the v2.2 account menu used. */
export function SignOutItem() {
  const { form, submit, pending, summary } = useFormAction(signOutAction);
  return (
    <form ref={form} action={submit} className="contents">
      <button type="submit" role="menuitem" tabIndex={-1} disabled={pending} aria-busy={pending || undefined} className={MENU_ROW}>
        <Icon icon={LogOut} />
        <span className="flex-1">Sign out</span>
      </button>
      {summary ? (
        <p role="alert" tabIndex={-1} data-form-summary className="px-3 py-1 text-small text-bad">
          {summary}
        </p>
      ) : null}
    </form>
  );
}

/** A separator between groups of entries: 1 px `border`, 6 px margins (10 §8). */
export function MenuSeparator() {
  return <div role="separator" className="mx-1 my-1.5 h-px bg-border" />;
}
