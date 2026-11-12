"use client";

import { CirclePlus } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { ACCOUNT_ITEMS, ADD_ITEMS, initialOf } from "@/lib/shell/menus";
import { MenuItemLink, MenuSeparator, SignOutItem } from "./MenuItems";
import { ShellMenu } from "./ShellMenu";

/** ⊕: invite people, or add credits, with the balance beside it when it could be read. */
export function AddMenu({ credits }: Readonly<{ credits: number | null }>) {
  return (
    <ShellMenu
      label="Invite or add credits"
      align="end"
      trigger={(props) => (
        <button {...props} aria-label="Invite or add credits" className="grid size-10 place-items-center rounded-full text-text-2 live:hover:bg-soft">
          <Icon icon={CirclePlus} size={22} />
        </button>
      )}
    >
      {ADD_ITEMS.map((item) => (
        <MenuItemLink
          key={item.id}
          href={item.href}
          icon={item.icon}
          testId={item.id === "credits" ? "credit-balance" : undefined}
          trailing={item.id === "credits" && credits !== null ? <span className="text-small text-muted">{credits} left</span> : undefined}
        >
          {item.label}
        </MenuItemLink>
      ))}
    </ShellMenu>
  );
}

/** The round avatar: decision 0103's account menu, the address signed in, Settings and Sign out. */
export function AccountMenu({ email }: Readonly<{ email: string | null }>) {
  return (
    <ShellMenu
      label="Account"
      align="end"
      header={
        email ? (
          <p className="truncate px-3 pt-1 pb-2 text-small text-muted" data-testid="account-email">
            {email}
          </p>
        ) : null
      }
      trigger={(props) => (
        <button {...props} aria-label="Account" className="grid size-10 place-items-center rounded-full bg-link text-body font-bold text-on-dark">
          {initialOf(email)}
        </button>
      )}
    >
      {ACCOUNT_ITEMS.map((item) => (
        <MenuItemLink key={item.id} href={item.href} icon={item.icon}>
          {item.label}
        </MenuItemLink>
      ))}
      <MenuSeparator />
      <SignOutItem />
    </ShellMenu>
  );
}
