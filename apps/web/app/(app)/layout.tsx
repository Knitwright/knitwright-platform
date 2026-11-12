import { AppShell } from "@/components/shell/AppShell";
import { readCredits, readWorkspace } from "@/components/shell/load-shell";
import { requireMember } from "@/lib/server/page-guards";

/**
 * The frame of the studio: the dashboard shell (decision 0138). It checks the session and the
 * brand, and so does every page inside it: the framework does not run this layout again when the
 * user moves from one of those pages to another.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { email, brand } = await requireMember();
  const [workspace, credits] = await Promise.all([readWorkspace(brand), readCredits(brand.id)]);

  return <AppShell data={{ email, brandName: brand.name, workspace, credits }}>{children}</AppShell>;
}
