import { Folder, Sparkles, Trash2, Users } from "lucide-react";
import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DesignCard } from "@/components/home/DesignCard";
import { GarmentOutline } from "@/components/home/GarmentOutline";
import { FolderGrid } from "@/components/projects/v3/FolderGrid";
import { GuideTiles, NewTile } from "@/components/projects/v3/GridTiles";
import { ProjectGrid } from "@/components/projects/v3/ProjectGrid";
import { StartCards } from "@/components/projects/v3/StartCards";
import { EmptyList, ProjectsSkeleton, ViewerOnly } from "@/components/projects/v3/States";
import { SubNav } from "@/components/projects/v3/SubNav";
import { AppShell } from "@/components/shell/AppShell";
import { TopBarTabs } from "@/components/shell/TopBarSlot";
import { JumpBackIn, TypeTag } from "@/components/studio/home/JumpBackIn";
import { Icon } from "@/components/ui/Icon";
import { JourneyChip } from "@/components/ui/JourneyChip";
import { ErrorState } from "@/components/ui/PageStates";
import { folderCounts, type ProjectItem } from "@/lib/projects-page/items";
import { devRoutesEnabled } from "../dev-routes";

export const metadata: Metadata = { title: "Projects fixture", robots: { index: false, follow: false } };

/**
 * The Projects page with made-up data (decision 0139), for the 1440 × 900 comparison with d01–d06.
 * It reads nothing and needs no session; a production build answers 404 unless DEV_UI_ROUTES is "on".
 * `?tab=` recent, folders, shared, trash, ai, loading, error or viewer shows each list and state.
 */

const NOW = new Date("2026-11-13T18:00:00Z");
const hoursAgo = (hours: number): string => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

const item = (id: number, name: string, kind: ProjectItem["kind"], hours: number, artboards: number | null): ProjectItem => ({
  kind,
  id: `00000000-0000-4000-8000-00000000000${id}`,
  name,
  createdAt: hoursAgo(hours * 2),
  updatedAt: hoursAgo(hours),
  artboards,
  detail: kind === "design" ? "Crew neck tee" : "Launch pack",
  folderId: null,
  trashedAt: null,
});

const ITEMS: readonly ProjectItem[] = [
  item(1, "Northfield FC · Home kit launch", "launch", 13, 8),
  item(2, "Away kit 2027", "design", 48, null),
  item(3, "Goalkeeper kit", "design", 120, null),
  item(4, "Team store promo", "launch", 288, 4),
  item(5, "Spring drop collection", "launch", 312, 12),
  item(6, "Compression top v3", "design", 504, null),
];

const FOLDERS = folderCounts(
  ["Home kits 2027", "Training wear", "Sponsor assets", "Team store", "Archive 2025/26"].map((name, index) => ({
    id: `10000000-0000-4000-8000-00000000000${index}`,
    name,
    createdAt: hoursAgo(index * 24),
  })),
  [],
);

const TABS = [
  { href: "/dev/projects?tab=recent" as Route, label: "Recent" },
  { href: "/dev/projects" as Route, label: "Projects" },
  { href: "/dev/projects?tab=ai" as Route, label: "AI Creations" },
];

const view = { sort: "recent" as const, search: "" };

function Recent() {
  return (
    <>
      <h1 className="text-h1 text-text">Good evening, Northfield FC</h1>
      <StartCards />
      <JumpBackIn chip="all" path="/dev/projects?tab=recent">
        <ul aria-label="Designs of Northfield FC, newest first" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.slice(0, 4).map((entry) => (
            <li key={entry.id} className="flex flex-col gap-2">
              <TypeTag label="Design" />
              <DesignCard
                card={{ id: entry.id, name: entry.name, styleNumber: "", season: "", garmentType: "crew-tee", garmentLabel: "Crew neck tee", currentVersion: 1, createdAt: entry.createdAt, updatedAt: entry.updatedAt, changed: "2 days ago" }}
                art={<GarmentOutline />}
                step={<JourneyChip step="design" />}
              />
            </li>
          ))}
        </ul>
      </JumpBackIn>
    </>
  );
}

function List({ tab }: Readonly<{ tab: string }>) {
  if (tab === "recent") return <Recent />;
  if (tab === "loading") return <ProjectsSkeleton />;
  if (tab === "error") return <ErrorState title="Your projects could not be read" requestId="dev-fixture">Nothing in any project has changed.</ErrorState>;
  if (tab === "ai")
    return (
      <EmptyList icon={<Icon icon={Sparkles} size={22} />} title="No AI pictures yet">
        <p>Scenes you shoot on a launch canvas, with your garment locked, and lifestyle pictures of your designs appear here.</p>
      </EmptyList>
    );
  const current = tab === "folders" || tab === "shared" || tab === "trash" ? tab : tab === "viewer" ? "trash" : "projects";
  return (
    <>
      <h1 className="sr-only">Projects</h1>
      <SubNav current={current} path="/dev/projects" {...view} />
      {current === "projects" ? (
        <ProjectGrid label="Projects of Northfield FC" items={ITEMS} folders={FOLDERS} canEdit now={NOW} before={<NewTile />} after={<GuideTiles />} />
      ) : null}
      {current === "folders" ? <FolderGrid folders={FOLDERS} /> : null}
      {current === "shared" ? (
        <EmptyList icon={<Icon icon={Users} size={22} />} title="Nothing shared with you yet">
          <p>Designs another club or brand invites you to by email appear here.</p>
        </EmptyList>
      ) : null}
      {tab === "trash" ? (
        <EmptyList icon={<Icon icon={Trash2} size={22} />} title="Trash is empty">
          <p>Projects in the Trash stay here until you restore them or delete them for good.</p>
        </EmptyList>
      ) : null}
      {tab === "viewer" ? <ViewerOnly brandName="Northfield FC" /> : null}
      {tab === "empty-folders" ? <EmptyList icon={<Icon icon={Folder} size={22} />} title="No folders yet"><p>Make a folder with New folder.</p></EmptyList> : null}
    </>
  );
}

export default async function DevProjectsPage({ searchParams }: PageProps<"/dev/projects">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const tab = String((await searchParams).tab ?? "projects");
  return (
    <AppShell data={{ email: "ana@example.test", brandName: "Northfield FC", workspace: { isClub: true, setUp: false }, credits: 1240 }}>
      <TopBarTabs label="Projects" tabs={TABS} />
      <div className="flex flex-col gap-8 pt-2">
        <List tab={tab} />
      </div>
    </AppShell>
  );
}
