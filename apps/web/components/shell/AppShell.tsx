import type { ReactNode } from "react";
import { PRODUCT } from "@/lib/config/product";
import { helpHref } from "@/lib/shell/menus";
import type { Workspace } from "@/lib/shell/nav";
import { PlansHost } from "@/components/plans/PlansHost";
import { LengthUnitProvider } from "@/components/units/LengthUnitContext";
import type { GarmentUnit } from "@/lib/units/preference";
import { HelpBubble } from "./HelpBubble";
import { Rail } from "./Rail";
import { ShellMain } from "./ShellMain";
import { TopBar } from "./TopBar";

/**
 * The dashboard shell (09 "Global shell", 08 §3 as amended by 09, decision 0138): the 96 px rail on
 * the left, and beside it the 76 px top bar over the page, with the gold help bubble bottom right.
 * It replaces decision 0103's glass top bar. The data it draws is read once by the layout.
 */

export type ShellData = Readonly<{
  email: string | null;
  brandName: string;
  workspace: Workspace;
  credits: number | null;
  /** The unit the person reads garment lengths in (decision 0144). Millimetres when not given. */
  lengthUnit?: GarmentUnit;
}>;

export function AppShell({ data, children }: Readonly<{ data: ShellData; children: ReactNode }>) {
  const help = helpHref(PRODUCT.contactEmail);
  return (
    <div className="flex min-h-dvh w-full bg-bg">
      <Rail workspace={data.workspace} brandName={data.brandName} helpHref={help} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar email={data.email} brandName={data.brandName} workspace={data.workspace} credits={data.credits} helpHref={help} />
        <ShellMain>
          <LengthUnitProvider unit={data.lengthUnit ?? "mm"}>{children}</LengthUnitProvider>
        </ShellMain>
      </div>
      <HelpBubble href={help} />
      {/* The plans modal Upgrade and every ♛ gate open (decision 0144). */}
      <PlansHost />
    </div>
  );
}
