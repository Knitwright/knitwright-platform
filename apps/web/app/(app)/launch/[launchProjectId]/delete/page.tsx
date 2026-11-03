import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteForm } from "@/components/deletion/DeleteForm";
import { PageIntro } from "@/components/shell/PageIntro";
import { PageSection } from "@/components/shell/PageSection";
import { can } from "@/lib/clubs/roles";
import { removeLaunchProjectAction } from "@/lib/launch/actions";
import { launchProjectPath } from "@/lib/launch";
import { loadLaunchProject } from "@/lib/launch/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Delete launch project" };

/** What goes, in the plain words of the screen. A canvas with nothing on it yet says that too. */
const whatGoes = (boards: number): string => {
  const canvas =
    boards === 0
      ? "This deletes the canvas, which has nothing on it yet"
      : `This deletes the canvas and the ${boards === 1 ? "one board" : `${boards} boards`} on it, with their connectors`;
  return `${canvas}, every saved version of it, the runs recorded against it and anything it has written for the Store to collect. The design it launches is not touched, and the pictures its runs made stay among your files. It cannot be undone.`;
};

/**
 * Deleting a launch project (spec Launch shell). `removeLaunchProjectAction` existed with no screen,
 * so a brand could make a canvas and never get rid of it; this is its door, in the shape the design
 * delete page already uses: what goes, the typed word, and a way back that changes nothing.
 *
 * The design is not touched. A Design board points at a design version; what goes is the canvas
 * itself: its boards and connectors, its saved versions, the shoots and flow runs recorded against
 * it, and any listing payload it has written for the Store to collect (all `on delete cascade` from
 * `launch_projects`). The pictures a run made stay in storage as the brand's own files.
 */
export default async function DeleteLaunchProjectPage({ params }: PageProps<"/launch/[launchProjectId]/delete">) {
  const { brand } = await requireMember();
  const { launchProjectId } = await params;
  const project = await loadLaunchProject(await sessionClient(), brand.id, launchProjectId);
  if (project === null) notFound();
  const boards = project.boards.length;

  return (
    <div className="flex flex-col gap-8">
      <PageIntro eyebrow="Delete launch project" title={project.name} />
      <PageSection
        id="delete-launch-project"
        title="What this deletes"
        tone="warn"
        description={whatGoes(boards)}
      >
        {can(brand.role, "manageKit") ? (
          <DeleteForm action={removeLaunchProjectAction} hidden={{ launchProjectId: project.id }} submitLabel="Delete this launch project" busyLabel="Deleting" />
        ) : (
          <p className="text-[15px] text-muted">Only owners, admins and kit managers can delete a launch project.</p>
        )}
        <p className="mt-4 text-sm">
          <Link href={launchProjectPath(project.id) as Route} className="underline">
            Keep it and go back
          </Link>
        </p>
      </PageSection>
    </div>
  );
}
