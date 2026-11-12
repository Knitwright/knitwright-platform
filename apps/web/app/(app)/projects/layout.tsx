import { TopBarTabs } from "@/components/shell/TopBarSlot";
import { PROJECTS_TABS } from "@/lib/projects-page/paths";
import { requireMember } from "@/lib/server/page-guards";

/**
 * The Projects page's frame (09 screen 14, decision 0139): the top bar's tabs Recent, Projects and
 * AI Creations. It checks the session and the brand, and so does every page inside it: the framework
 * does not run a layout again when the person moves between its pages.
 */
export default async function ProjectsLayout({ children }: LayoutProps<"/projects">) {
  await requireMember();
  return (
    <div className="flex flex-col gap-8 pt-2">
      <TopBarTabs label="Projects" tabs={PROJECTS_TABS} />
      {children}
    </div>
  );
}
