import type { Metadata } from "next";
import Link from "next/link";
import { MarketingForm } from "@/components/consent/MarketingForm";
import { DeleteForm } from "@/components/deletion/DeleteForm";
import { DisplayNameForm } from "@/components/profile/DisplayNameForm";
import { PageIntro } from "@/components/shell/PageIntro";
import { PageSection } from "@/components/shell/PageSection";
import { setMarketingConsentAction } from "@/lib/consent/actions";
import { currentMarketingChoice } from "@/lib/consent/consent";
import { loadMarketingEvents } from "@/lib/consent/service";
import { deleteAccountAction } from "@/lib/deletion/actions";
import { setDisplayNameAction } from "@/lib/profile/actions";
import { profileNameOf } from "@/lib/profile/name";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { email, brands } = await requireMember();
  const client = await sessionClient();
  const { data } = await client.auth.getUser();
  const name = profileNameOf(data.user?.user_metadata);
  const marketing = currentMarketingChoice(await loadMarketingEvents(client))?.granted === true;

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow="Settings"
        title="Your account"
        lead={
          <>
            Signed in as {email}. Read how your data is handled in the{" "}
            <Link href="/legal/privacy" className="underline">
              privacy notice
            </Link>
            .
          </>
        }
      />

      <PageSection id="your-name" title="Your name">
        <DisplayNameForm action={setDisplayNameAction} defaultName={name} />
      </PageSection>

      <PageSection
        id="emails"
        title="Emails from us"
        description="Emails about your account, such as sign-in links, always come. Marketing emails come only if you tick this box, and every one has a link to stop them."
      >
        <MarketingForm action={setMarketingConsentAction} granted={marketing} />
      </PageSection>

      <PageSection
        id="delete-account"
        title="Delete your account"
        tone="warn"
        description={`This deletes your account and your ${brands.length === 1 ? "brand" : `${brands.length} brands`} with every design, version, uploaded picture and download record in them. It cannot be undone. Download any tech packs you want to keep first.`}
      >
        <DeleteForm action={deleteAccountAction} submitLabel="Delete my account" busyLabel="Deleting" />
      </PageSection>
    </div>
  );
}
