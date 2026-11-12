import type { Metadata } from "next";
import Link from "next/link";
import { InvitationsForYou } from "@/components/club/InvitationsForYou";
import { MembersPanel } from "@/components/club/MembersPanel";
import { MarketingForm } from "@/components/consent/MarketingForm";
import { DeleteForm } from "@/components/deletion/DeleteForm";
import { UpgradeButton } from "@/components/plans/UpgradeButton";
import { DisplayNameForm } from "@/components/profile/DisplayNameForm";
import { SettingsCard, SettingsPart } from "@/components/settings/v3/SettingsCard";
import { accountSummary, memberSummary } from "@/components/settings/v3/summary";
import { UnitsForm } from "@/components/settings/v3/UnitsForm";
import { readCredits } from "@/components/shell/load-shell";
import { buttonClasses } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { can } from "@/lib/clubs/roles";
import { listInvitations, listMembers, myInvitations } from "@/lib/clubs/service";
import { setMarketingConsentAction } from "@/lib/consent/actions";
import { currentMarketingChoice } from "@/lib/consent/consent";
import { loadMarketingEvents } from "@/lib/consent/service";
import { deleteAccountAction } from "@/lib/deletion/actions";
import { PLAN_SETTINGS } from "@/lib/plans/catalogue";
import { currentPlanLine } from "@/lib/plans/view";
import { setDisplayNameAction } from "@/lib/profile/actions";
import { profileNameOf } from "@/lib/profile/name";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
import { setLengthUnitAction } from "@/lib/units/actions";
import { unitSummary } from "@/lib/units/preference";
import { preferredLengthUnit } from "@/lib/units/server";

export const metadata: Metadata = { title: "Settings" };

/**
 * Settings (09 screen 19, d19; plan v6 P6, decision 0144): the cards Plan & billing, Members and
 * Units, then Account and Get more credits, each opening its part below. Members moved here from the
 * club page; the plan is the free plan until C1 records subscriptions, and credits are bought on the
 * credits page once C1 sells them.
 */
export default async function SettingsPage() {
  const { email, brands, brand, userId } = await requireMember();
  const client = await sessionClient();
  const [{ data }, events, credits, unit, members, invitations, mine] = await Promise.all([
    client.auth.getUser(),
    loadMarketingEvents(client),
    readCredits(brand.id),
    preferredLengthUnit(userId),
    listMembers(client, brand.id),
    listInvitations(client, brand.id),
    myInvitations(client),
  ]);
  const name = profileNameOf(data.user?.user_metadata);
  const marketing = currentMarketingChoice(events)?.granted === true;
  const secondary = buttonClasses("secondary");

  return (
    <div className="flex flex-col gap-6 pt-4 pb-16">
      <h1 className="text-h1 text-text">Settings</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <SettingsCard title="Plan & billing" summary={currentPlanLine(credits)}>
          <LinkButton href="/credits" variant="secondary">
            Get more credits
          </LinkButton>
          <UpgradeButton className={secondary}>See plans</UpgradeButton>
        </SettingsCard>
        <SettingsCard title="Members" summary={memberSummary(members.map((member) => member.role))} href="#members" />
        <SettingsCard title="Units" summary={unitSummary(unit)} href="#units" />
        <SettingsCard title="Account" summary={accountSummary(name, email)} href="#account" />
        <SettingsCard
          title="Get more credits"
          summary={PLAN_SETTINGS.isPlaceholder ? "Credit packs arrive with checkout. Your balance and history are on the credits page." : "Top up your balance."}
        >
          <LinkButton href="/credits" variant="secondary">
            Open credits
          </LinkButton>
        </SettingsCard>
      </div>

      <SettingsPart id="account" title="Account" lead={<>Signed in as {email}. Read how your data is handled in the <Link href="/legal/privacy" className="text-link">privacy notice</Link>.</>}>
        <DisplayNameForm action={setDisplayNameAction} defaultName={name} />
      </SettingsPart>

      <SettingsPart id="emails" title="Emails from us" lead="Emails about your account, such as sign-in links, always come. Marketing emails come only if you tick this box, and every one has a link to stop them.">
        <MarketingForm action={setMarketingConsentAction} granted={marketing} />
      </SettingsPart>

      <SettingsPart id="members" title="Members" lead="Owners and admins change members. Kit managers change the kit, seasons and rosters. Viewers can only look.">
        <div className="flex flex-col gap-6">
          {mine.length > 0 ? (
            <div className="flex flex-col gap-2" data-testid="invitations-for-you">
              <h3 className="text-body font-semibold text-text">You have been invited</h3>
              <InvitationsForYou invitations={mine} />
            </div>
          ) : null}
          <MembersPanel members={members} invitations={invitations} me={userId} canManage={can(brand.role, "manageMembers")} />
        </div>
      </SettingsPart>

      <SettingsPart id="units" title="Units" lead="Millimetres is how factories write a garment. Choose the unit you read lengths in; pixels are always used for social sizes.">
        <UnitsForm action={setLengthUnitAction} unit={unit} />
      </SettingsPart>

      <SettingsPart
        id="delete-account"
        title="Delete your account"
        tone="warn"
        lead={`This deletes your account and your ${brands.length === 1 ? "brand" : `${brands.length} brands`} with every design, version, uploaded picture and download record in them. It cannot be undone. Download any tech packs you want to keep first.`}
      >
        <DeleteForm action={deleteAccountAction} submitLabel="Delete my account" busyLabel="Deleting" />
      </SettingsPart>
    </div>
  );
}
