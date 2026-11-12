import Link from "next/link";
import { Vote } from "lucide-react";
import { CommitteePanel, type CommitteeDesign } from "@/components/collect/CommitteePanel";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/PageStates";
import { can } from "@/lib/clubs/roles";
import { listProjects } from "@/lib/projects/service";
import type { Brand } from "@/lib/server/core/guard";
import { sessionClient } from "@/lib/server/deps";
import { listCommittee } from "@/lib/share/committee/service";

/**
 * Team › Approvals (09 screen 17; F-T3): a committee link per design, its votes per version, the
 * comments pinned on the kit and the approvals, and the lock on the version the committee chose. The
 * committee section of Collect, moved here (decision 0144).
 */

const DESIGNS_SHOWN = 6;

export async function ApprovalsTab({ brand }: Readonly<{ brand: Brand }>) {
  const client = await sessionClient();
  const designs = await listProjects(client, brand.id, DESIGNS_SHOWN);
  const canEdit = can(brand.role, "manageKit");
  const committee: readonly CommitteeDesign[] = await Promise.all(
    designs.projects.map(async (design) => {
      const read = await listCommittee(client, brand.id, design.id);
      return { projectId: design.id, name: design.name, currentVersion: design.currentVersion, links: read.links, lock: read.lock };
    }),
  );

  if (committee.length === 0) {
    return (
      <EmptyState icon={<Icon icon={Vote} size={22} />} title="No designs to approve yet" action={<LinkButton href="/studio/new">Start a design</LinkButton>}>
        Start a design, then share up to three versions with your committee here.
      </EmptyState>
    );
  }

  return (
    <section aria-labelledby="committee" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="committee" className="text-h3 text-text">
          Committee links
        </h2>
        <p className="max-w-3xl text-body text-muted">
          Share up to three versions, read only. Your committee pins comments on a point of the kit, votes between the versions and approves one under their name. You lock the version they chose.
        </p>
      </div>
      <ul className="flex flex-col gap-4">
        {committee.map((design) => (
          <li key={design.projectId} className="flex flex-col gap-3 rounded-2xl border border-border p-5">
            <h3 className="text-title text-text">
              <Link href={`/studio/${design.projectId}`} className="no-underline live:hover:underline">
                {design.name}
              </Link>{" "}
              <span className="font-normal text-muted">· version {design.currentVersion}</span>
            </h3>
            {canEdit ? <CommitteePanel design={design} /> : <p className="text-small text-muted">Read only for your role.</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
