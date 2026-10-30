import { StudioSidebar } from "@/components/studio/home/Sidebar";
import { StudioTopBar } from "@/components/studio/home/TopBar";
import { requireMember } from "@/lib/server/page-guards";

/**
 * The catalogue sits in the same frame as the studio home (spec F-S4): the left sidebar and the top
 * bar. The credits counter sits in the studio header above it. It checks the session and the brand,
 * and so does every page inside it: the framework does not run a layout again when the user moves
 * from one of those pages to another.
 */
export default async function CatalogueLayout({ children }: LayoutProps<"/catalogue">) {
  await requireMember();

  return (
    <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <StudioSidebar />
      </div>
      <div className="flex min-w-0 flex-col gap-8">
        <StudioTopBar />
        {children}
      </div>
    </div>
  );
}
