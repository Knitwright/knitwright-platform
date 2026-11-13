import type { Metadata, Route } from "next";
import { FileUp, Link2, UserPlus } from "lucide-react";
import { ApprovalsTab } from "@/components/team/v3/ApprovalsTab";
import { LinkTabs } from "@/components/team/v3/LinkTabs";
import { ROSTER_HREFS, RosterTab } from "@/components/team/v3/RosterTab";
import { SeasonsTab } from "@/components/team/v3/SeasonsTab";
import { StoresTab } from "@/components/team-stores/StoresTab";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { can } from "@/lib/clubs/roles";
import { listSeasons } from "@/lib/clubs/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
import { rosterViewFrom, teamTabFrom } from "@/lib/team/view";

export const metadata: Metadata = { title: "Team" };

/**
 * Team (09 screen 17, d18; plan v6 P6, decision 0144): tabs Roster · Approvals · Seasons · Stores (plan v6 C2, decision 0153), over the
 * club page and Collect, which it replaces (both redirect here). The tabs and the header's buttons
 * are links, so every state has an address and the page works without scripts.
 */
export default async function TeamPage({ searchParams }: PageProps<"/team">) {
  const { brand } = await requireMember();
  const query = await searchParams;
  const tab = teamTabFrom(query.tab);
  const view = tab === "roster" ? rosterViewFrom(query.view) : null;
  const seasons = await listSeasons(await sessionClient(), brand.id);
  const newest = seasons[0]?.name ?? null;
  const canEdit = can(brand.role, "manageKit");

  return (
    <div className="flex flex-col gap-6 pt-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 text-text">Team · {brand.name}</h1>
        {canEdit ? (
          <div className="flex flex-wrap gap-3">
            <LinkButton href={ROSTER_HREFS.signup} variant="secondary" icon={<Icon icon={Link2} />}>
              Player sign-up link
            </LinkButton>
            <LinkButton href={ROSTER_HREFS.edit} variant="secondary" icon={<Icon icon={FileUp} />}>
              Import CSV
            </LinkButton>
            <LinkButton href={ROSTER_HREFS.edit} icon={<Icon icon={UserPlus} />}>
              Add player
            </LinkButton>
          </div>
        ) : null}
      </header>

      <LinkTabs
        label="Team"
        current={tab}
        tabs={[
          { id: "roster", href: "/team" as Route, label: newest ? `Roster ${newest}` : "Roster" },
          { id: "approvals", href: "/team?tab=approvals" as Route, label: "Approvals" },
          { id: "seasons", href: "/team?tab=seasons" as Route, label: "Seasons" },
          { id: "stores", href: "/team?tab=stores" as Route, label: "Stores" },
        ]}
      />

      {canEdit ? null : <p className="text-body text-muted">Your role in this club can look but not change anything.</p>}
      {tab === "roster" ? <RosterTab brand={brand} view={view} /> : null}
      {tab === "approvals" ? <ApprovalsTab brand={brand} /> : null}
      {tab === "seasons" ? <SeasonsTab brand={brand} /> : null}
      {tab === "stores" ? <StoresTab brand={brand} /> : null}
    </div>
  );
}
