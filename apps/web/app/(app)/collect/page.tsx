import type { Metadata } from "next";
import Link from "next/link";
import { CommitteePanel, type CommitteeDesign } from "@/components/collect/CommitteePanel";
import { SignupPanel, type SeasonCollect } from "@/components/collect/SignupPanel";
import { PageIntro } from "@/components/shell/PageIntro";
import { PageSection } from "@/components/shell/PageSection";
import { Notice } from "@/components/ui/Notice";
import { can, ROLE_LABELS } from "@/lib/clubs/roles";
import { buildGrid } from "@/lib/clubs/signup/grid";
import { DEFAULT_SPORT } from "@/lib/clubs/signup/fields";
import { readChaseTemplates, readNumberRules, readSeasonSignup } from "@/lib/clubs/signup/service";
import { listSeasons } from "@/lib/clubs/service";
import { listProjects } from "@/lib/projects/service";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
import { listCommittee } from "@/lib/share/committee/service";

/**
 * Collect: the one place a kit manager asks other people for something (plan v5 Z7, decision 0087).
 * The committee is asked to comment, vote and approve (spec F-T3); the squad is asked for a shirt
 * name, a number and a size (spec F-T4).
 *
 * No delivery date is shown here, and none can be: the QC days and the freight days are both unset
 * (plan v5 owner decisions), so the page says what is missing instead of showing a date.
 */
export const metadata: Metadata = { title: "Collect" };

const DESIGNS_SHOWN = 6;
const SEASONS_SHOWN = 4;

export default async function CollectPage() {
  const session = await requireMember();
  const brand = session.brand;
  const role = brand.role;
  const client = await sessionClient();
  const admin = adminClient();
  const [designs, seasons, rules, templates] = await Promise.all([
    listProjects(client, brand.id, DESIGNS_SHOWN),
    listSeasons(client, brand.id),
    readNumberRules(admin),
    readChaseTemplates(admin),
  ]);
  const canEdit = can(role, "manageKit");

  const committee: readonly CommitteeDesign[] = await Promise.all(
    designs.projects.map(async (design) => {
      const read = await listCommittee(client, brand.id, design.id);
      return { projectId: design.id, name: design.name, currentVersion: design.currentVersion, links: read.links, lock: read.lock };
    }),
  );

  const collecting: readonly SeasonCollect[] = await Promise.all(
    seasons.slice(0, SEASONS_SHOWN).map(async (season) => {
      const read = await readSeasonSignup(client, brand.id, season.id);
      return {
        seasonId: season.id,
        name: season.name,
        sport: read.link?.sport ?? DEFAULT_SPORT,
        hasOpenLink: read.link !== null,
        openLinkId: read.link?.id ?? null,
        expiresAt: read.link?.expiresAt ?? null,
        grid: buildGrid(read.requests, read.entries),
      };
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow={`Collect · you are ${ROLE_LABELS[role].toLowerCase()}`}
        title="Ask your committee and your squad"
        lead="One link for the people who decide, one for the people who wear it. Neither needs an account, and both work on a phone."
      />

      {canEdit ? null : (
        <Notice tone="info">
          Your role in this club can look but not change anything. Ask an owner, an admin or a kit manager to make a link.
        </Notice>
      )}

      <PageSection
        id="committee"
        title="Committee links"
        description="Share up to three versions, read only. Your committee pins comments on a point of the kit, votes between the versions and approves one under their name. You lock the version they chose."
      >
        {committee.length === 0 ? (
          <p className="text-[15px] text-muted">
            No designs yet.{" "}
            <Link href="/studio/new" className="soft-link text-ink underline underline-offset-4">
              Start one
            </Link>
            , then come back and share it.
          </p>
        ) : (
          <ul className="flex flex-col gap-8">
            {committee.map((design) => (
              <li key={design.projectId} className="flex flex-col gap-3">
                <h3 className="text-[15px] font-medium text-ink">
                  <Link href={`/studio/${design.projectId}`} className="soft-link text-ink underline underline-offset-4">
                    {design.name}
                  </Link>{" "}
                  <span className="text-muted">· version {design.currentVersion}</span>
                </h3>
                {canEdit ? <CommitteePanel design={design} /> : <p className="text-sm text-muted">Read only for your role.</p>}
              </li>
            ))}
          </ul>
        )}
      </PageSection>

      <PageSection
        id="signup"
        title="Player sign-up"
        description="Paste your squad, send one link, and each player gives their shirt name, number and size with the size guide in front of them. Chase whoever is missing on WhatsApp or by email."
      >
        {collecting.length === 0 ? (
          <p className="text-[15px] text-muted">
            No seasons yet.{" "}
            <Link href="/club" className="soft-link text-ink underline underline-offset-4">
              Make a season
            </Link>
            , then come back and collect its sizes.
          </p>
        ) : (
          <ul className="flex flex-col gap-10">
            {collecting.map((season) => (
              <li key={season.seasonId} className="flex flex-col gap-3">
                <h3 className="text-[15px] font-medium text-ink">{season.name}</h3>
                {canEdit ? (
                  <SignupPanel season={season} rules={rules} templates={templates} clubName={brand.name} />
                ) : (
                  <p className="text-sm text-muted">Read only for your role.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </PageSection>
    </div>
  );
}
