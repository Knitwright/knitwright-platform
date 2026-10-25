import type { Metadata } from "next";
import Link from "next/link";
import { InvitationsForYou } from "@/components/club/InvitationsForYou";
import { KitPanel } from "@/components/club/KitPanel";
import { MembersPanel } from "@/components/club/MembersPanel";
import { SeasonsPanel } from "@/components/club/SeasonsPanel";
import { UseKitButton } from "@/components/club/UseKitButton";
import { ReorderButton } from "@/components/club/reorder/ReorderButton";
import { PageIntro } from "@/components/shell/PageIntro";
import { PageSection } from "@/components/shell/PageSection";
import { listArtworks } from "@/lib/artwork-intake/service";
import { can, ROLE_LABELS } from "@/lib/clubs/roles";
import { getKit, listInvitations, listMembers, listOrderHistory, listSeasons, myInvitations } from "@/lib/clubs/service";
import { listProjects } from "@/lib/projects/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Club" };

const DESIGNS_SHOWN = 12;
const date = (iso: string): string => iso.slice(0, 10);

export default async function ClubPage() {
  const { brand, userId } = await requireMember();
  const client = await sessionClient();
  const [kit, artworks, members, invitations, seasons, designs, history, mine] = await Promise.all([
    getKit(client, brand.id),
    listArtworks(client, brand.id),
    listMembers(client, brand.id),
    listInvitations(client, brand.id),
    listSeasons(client, brand.id),
    listProjects(client, brand.id, DESIGNS_SHOWN),
    listOrderHistory(client, brand.id),
    myInvitations(client),
  ]);
  const pictures = artworks.map((a) => ({ fileId: a.screenFileId, label: a.label }));
  const canEdit = can(brand.role, "manageKit");
  const canManageMembers = can(brand.role, "manageMembers");

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow={`Club · you are ${ROLE_LABELS[brand.role].toLowerCase()}`}
        title={brand.name}
        lead="Your kit, your people, your seasons and every design in one place. Next season starts with this season's sizes."
      />

      {mine.length > 0 ? (
        <PageSection id="invited" title="You have been invited" description="Join, then switch to the club under Brands.">
          <InvitationsForYou invitations={mine} />
        </PageSection>
      ) : null}

      <PageSection id="kit" title="Club kit" description="Colours, crest and sponsors. Use them on any design with one press; each design keeps its own copy.">
        <KitPanel kit={kit} pictures={pictures} canEdit={canEdit} />
      </PageSection>

      <PageSection id="members" title="Members and roles" description="Owners and admins change members. Kit managers change the kit, seasons and rosters. Viewers can only look.">
        <MembersPanel members={members} invitations={invitations} me={userId} canManage={canManageMembers} />
      </PageSection>

      <PageSection id="seasons" title="Seasons and rosters" description="One roster for each season, with a size for each player. Import a CSV, or start from last season.">
        <SeasonsPanel seasons={seasons} canEdit={canEdit} />
      </PageSection>

      <PageSection id="designs" title="Designs" description={designs.total > DESIGNS_SHOWN ? `Your newest ${DESIGNS_SHOWN} of ${designs.total}.` : undefined}>
        {designs.projects.length === 0 ? (
          <p className="text-[15px] text-muted">No designs yet. <Link href="/studio/new" className="soft-link text-cobalt-soft">Start one</Link>.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {designs.projects.map((design) => (
              <li key={design.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link href={`/studio/${design.id}`} className="soft-link block min-w-0 truncate py-2 text-[15px] leading-6 text-ink">
                  {design.name} <span className="text-muted">· {design.garmentLabel} · version {design.currentVersion}</span>
                </Link>
                {canEdit ? <UseKitButton projectId={design.id} version={design.currentVersion} /> : null}
              </li>
            ))}
          </ul>
        )}
      </PageSection>

      <PageSection id="orders" title="Order history" description="Each time a design was frozen for production. Reorder any of them in two clicks: Reorder, then Confirm.">
        {history.length === 0 ? (
          <p className="text-[15px] text-muted">Nothing has been frozen for production yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {history.map((entry) => (
              <li key={entry.releaseId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[15px]">
                <Link href={`/studio/${entry.projectId}`} className="soft-link min-w-0 truncate text-ink">{entry.designName} · {entry.label}</Link>
                <span className="font-mono text-sm text-muted">release {entry.number} · {date(entry.createdAt)}</span>
                {canEdit ? <ReorderButton releaseId={entry.releaseId} seasons={seasons} /> : null}
              </li>
            ))}
          </ul>
        )}
      </PageSection>
    </div>
  );
}
