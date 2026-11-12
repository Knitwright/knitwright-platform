import { AppShell } from "@/components/shell/AppShell";
import { readCredits, readWorkspace } from "@/components/shell/load-shell";
import { requireMember } from "@/lib/server/page-guards";
import { preferredLengthUnit } from "@/lib/units/server";

/**
 * The frame of the studio: the dashboard shell (decision 0138). It checks the session and the
 * brand, and so does every page inside it: the framework does not run this layout again when the
 * user moves from one of those pages to another.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { email, brand, userId } = await requireMember();
  const [workspace, credits, lengthUnit] = await Promise.all([readWorkspace(brand), readCredits(brand.id), preferredLengthUnit(userId)]);

  return <AppShell data={{ email, brandName: brand.name, workspace, credits, lengthUnit }}>{children}</AppShell>;
}
