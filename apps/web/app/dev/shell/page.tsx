import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/AppShell";
import { TopBarTabs } from "@/components/shell/TopBarSlot";
import { ProjectCard } from "@/components/ui/Card";
import { devRoutesEnabled } from "../dev-routes";
import { Placeholder } from "../ui/frame";

export const metadata: Metadata = {
  title: "Dashboard shell",
  robots: { index: false, follow: false },
};

/**
 * The dashboard shell with made-up data (decision 0138), for the 1440 × 900 comparison with the
 * reference image d01-projects.png. It reads nothing and needs no session; a production build answers
 * 404 unless DEV_UI_ROUTES is "on". `?club` shows a club's rail, `?new` the brand pill's gold New.
 */

const TABS = [
  { href: "/dev/shell?tab=recent" as Route, label: "Recent" },
  { href: "/dev/shell" as Route, label: "Projects" },
  { href: "/dev/shell?tab=ai" as Route, label: "AI Creations" },
];

const PROJECTS = [
  { title: "Northfield FC home kit", meta: "Viewed 13 hours ago", count: 8 },
  { title: "Away kit 2027", meta: "Viewed 2 days ago", count: 5 },
  { title: "Goalkeeper kit", meta: "Viewed 5 days ago", count: 3 },
  { title: "Team store promo", meta: "Viewed 12 days ago", count: 4 },
  { title: "Spring drop collection", meta: "Viewed 13 days ago", count: 12 },
  { title: "Compression top v3", meta: "Viewed 3 weeks ago", count: 2 },
];

export default async function DevShellPage({ searchParams }: PageProps<"/dev/shell">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const query = await searchParams;
  const workspace = { isClub: query.club !== undefined, setUp: query.new === undefined };
  return (
    <AppShell data={{ email: "ana@example.test", brandName: "Northfield FC", workspace, credits: 1240 }}>
      <TopBarTabs label="Projects" tabs={TABS} />
      <h1 className="sr-only">Projects</h1>
      <div className="grid grid-cols-2 gap-5 pt-6 md:grid-cols-3 lg:grid-cols-5">
        {PROJECTS.map((project) => (
          <ProjectCard key={project.title} title={project.title} meta={project.meta} count={project.count} thumb={<Placeholder label="Kit" />} />
        ))}
      </div>
    </AppShell>
  );
}
