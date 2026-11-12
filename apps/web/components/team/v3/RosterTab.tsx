import type { Route } from "next";
import { RosterEditor } from "@/components/club/RosterEditor";
import { SignupPanel, type SeasonCollect } from "@/components/collect/SignupPanel";
import { Notice } from "@/components/ui/Notice";
import type { Brand } from "@/lib/server/core/guard";
import { can } from "@/lib/clubs/roles";
import { getRoster, listSeasons } from "@/lib/clubs/service";
import { DEFAULT_SPORT } from "@/lib/clubs/signup/fields";
import { buildGrid } from "@/lib/clubs/signup/grid";
import { readChaseTemplates, readNumberRules, readSeasonSignup } from "@/lib/clubs/signup/service";
import { listProjects } from "@/lib/projects/service";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { listCommittee } from "@/lib/share/committee/service";
import { approvalSummary, rosterRows, type RosterView } from "@/lib/team/view";
import { ApprovalCard } from "./ApprovalCard";
import { RosterTable } from "./RosterTable";

/**
 * Team › Roster (09 screen 17, d18): the newest season's players in the Kittl table, the committee
 * card for each design with a live link, and under them what the header's buttons open: the roster
 * editor (Add player, Import CSV, from the club page) or the player sign-up link (from Collect).
 */

const DESIGNS_READ = 6;

export const ROSTER_HREFS = {
  edit: "/team?view=edit" as Route,
  signup: "/team?view=signup" as Route,
  approvals: "/team?tab=approvals" as Route,
};

export async function RosterTab({ brand, view }: Readonly<{ brand: Brand; view: RosterView | null }>) {
  const client = await sessionClient();
  const seasons = await listSeasons(client, brand.id);
  const newest = seasons[0] ?? null;
  const canEdit = can(brand.role, "manageKit");
  const [players, signup, designs] = await Promise.all([
    newest ? getRoster(client, brand.id, newest.id) : Promise.resolve([]),
    newest ? readSeasonSignup(client, brand.id, newest.id) : Promise.resolve(null),
    listProjects(client, brand.id, DESIGNS_READ),
  ]);
  const grid = signup ? buildGrid(signup.requests, signup.entries) : null;
  const committees = await Promise.all(
    designs.projects.map(async (design) => ({ design, read: await listCommittee(client, brand.id, design.id) })),
  );
  const now = new Date();
  const live = committees.filter(({ read }) => read.links.some((link) => link.revokedAt === null));

  return (
    <div className="flex flex-col gap-6">
      <RosterTable rows={rosterRows(players, grid)} season={newest?.name ?? null} signupHref={ROSTER_HREFS.signup} editHref={ROSTER_HREFS.edit} canEdit={canEdit} />
      {live.map(({ design, read }) => (
        <ApprovalCard key={design.id} design={design.name} summary={approvalSummary(read.links, read.lock?.version ?? null, now)} href={ROSTER_HREFS.approvals} />
      ))}
      {view === "edit" && newest ? (
        <section aria-labelledby="roster-edit" className="flex flex-col gap-3 rounded-2xl border border-border p-5">
          <h2 id="roster-edit" className="text-title text-text">
            Edit the {newest.name} roster
          </h2>
          <RosterEditor key={newest.id} seasonId={newest.id} canEdit={canEdit} />
        </section>
      ) : null}
      {view === "signup" ? <SignupSection brand={brand} season={newest} grid={grid} signup={signup} canEdit={canEdit} /> : null}
    </div>
  );
}

type SignupProps = Readonly<{
  brand: Brand;
  season: Readonly<{ id: string; name: string }> | null;
  grid: ReturnType<typeof buildGrid> | null;
  signup: Awaited<ReturnType<typeof readSeasonSignup>> | null;
  canEdit: boolean;
}>;

async function SignupSection({ brand, season, grid, signup, canEdit }: SignupProps) {
  if (!season || !grid) return <Notice tone="info">Make a season first, then send its sign-up link.</Notice>;
  if (!canEdit) return <Notice tone="info">Your role in this club can look but not change anything. Ask an owner, an admin or a kit manager to make a link.</Notice>;
  const admin = adminClient();
  const [rules, templates] = await Promise.all([readNumberRules(admin), readChaseTemplates(admin)]);
  const collect: SeasonCollect = {
    seasonId: season.id,
    name: season.name,
    sport: signup?.link?.sport ?? DEFAULT_SPORT,
    hasOpenLink: signup?.link != null,
    openLinkId: signup?.link?.id ?? null,
    expiresAt: signup?.link?.expiresAt ?? null,
    grid,
  };
  return (
    <section aria-labelledby="player-signup" className="flex flex-col gap-3 rounded-2xl border border-border p-5" data-testid="team-signup">
      <h2 id="player-signup" className="text-title text-text">
        Player sign-up · {season.name}
      </h2>
      <p className="text-body text-muted">
        Paste your squad, send one link, and each player gives their shirt name, number and size with the size guide in front of them. Chase whoever is missing on WhatsApp or by email.
      </p>
      <SignupPanel season={collect} rules={rules} templates={templates} clubName={brand.name} />
    </section>
  );
}
