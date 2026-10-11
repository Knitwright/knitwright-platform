import type { Metadata, Route } from "next";
import { AuthCard, TextLink } from "@/components/auth/AuthCard";
import { UnsubscribeForm } from "@/components/consent/UnsubscribeForm";
import { Notice } from "@/components/ui/Notice";
import { unsubscribeSchema } from "@/lib/consent/schemas";
import { unsubscribeSigningKey } from "@/lib/consent/signing";
import { verifyUnsubscribe } from "@/lib/consent/unsubscribe-token";
import { MARKETING_UNSUBSCRIBE } from "@/lib/consent/wording";

export const metadata: Metadata = {
  title: "Unsubscribe",
  // The address holds a token that names a person. Keep it out of search results and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Opened from the unsubscribe link in a marketing email, without signing in. Showing the page
 * changes nothing; pressing the button records the withdrawal (lib/consent/actions.ts).
 */
export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const query = unsubscribeSchema.safeParse(await searchParams);
  const verified = query.success ? verifyUnsubscribe(query.data.token, unsubscribeSigningKey()) : null;

  return (
    <AuthCard title="Unsubscribe" lead={`${MARKETING_UNSUBSCRIBE.text} Emails about your account, such as sign-in links, still come.`}>
      {query.success && verified?.ok ? (
        <UnsubscribeForm token={query.data.token} />
      ) : (
        <Notice>
          This link could not be checked. Sign in and change your email choice in{" "}
          <TextLink href={"/settings" as Route}>Settings</TextLink>.
        </Notice>
      )}
    </AuthCard>
  );
}
