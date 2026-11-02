import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/shell/PageIntro";
import { launchProjectPath } from "@/lib/launch";
import { listLaunchVersions, loadLaunchProject } from "@/lib/launch/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Launch version history" };

/**
 * The main menu's Version history (spec Launch shell). Each row is the canvas as it stood when
 * somebody pressed Save, and a saved version is never rewritten, so this page is a record rather
 * than a view that can disagree with itself.
 */
export default async function LaunchHistoryPage({ params }: PageProps<"/launch/[launchProjectId]/history">) {
  const { brand } = await requireMember();
  const { launchProjectId } = await params;
  const client = await sessionClient();
  const project = await loadLaunchProject(client, brand.id, launchProjectId);
  if (project === null) notFound();
  const versions = await listLaunchVersions(client, brand.id, launchProjectId);

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow={`${project.name} · launch`}
        title="Version history"
        lead="Every version somebody saved from the main menu, newest first. A saved version is never changed, so what you see here is what the canvas held at that moment."
      />

      {versions.length === 0 ? (
        <section aria-label="No saved versions yet" className="flex flex-col gap-2 rounded-2xl border border-dashed border-hairline p-6">
          <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">Nothing saved yet</h2>
          <p className="max-w-xl text-[15px] leading-relaxed text-muted">
            This canvas has no saved version. Open it and choose Save a version from the menu, and it appears here.
          </p>
          <p>
            <Link href={launchProjectPath(launchProjectId) as Route} className="soft-link text-cobalt-soft">
              Open the canvas
            </Link>
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-2">
          {versions.map((one) => (
            <li key={one.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-2xl border border-hairline bg-surface px-4 py-3">
              <span className="text-[15px] font-medium text-ink">Version {one.version}</span>
              <span className="text-[15px] text-muted">{one.boards === 1 ? "1 board" : `${one.boards} boards`}</span>
              <time dateTime={one.createdAt} className="font-mono text-xs text-muted">
                {one.createdAt}
              </time>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[13px] text-muted">
        <Link href={launchProjectPath(launchProjectId) as Route} className="soft-link text-cobalt-soft">
          Back to the canvas
        </Link>
      </p>
    </div>
  );
}
