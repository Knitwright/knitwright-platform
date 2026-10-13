import type { Metadata, Route } from "next";
import { AuthCard, TextLink } from "@/components/auth/AuthCard";
import { SignUpChoices } from "@/components/auth/SignUpChoices";
import { AccessRequestForm } from "@/components/leads/AccessRequestForm";
import { Notice } from "@/components/ui/Notice";
import { isSignupOpen } from "@/lib/auth/queries";
import { getEnv } from "@/lib/config/env";
import { sessionClient } from "@/lib/server/deps";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage() {
  const env = getEnv();
  const open = await isSignupOpen(await sessionClient());

  return (
    <AuthCard
      title="Create your account"
      lead="Enter your email and we will send you a link. Free during the beta, no card needed."
      footer={
        <>
          Already have an account? <TextLink href="/sign-in">Sign in</TextLink>
        </>
      }
    >
      {open ? null : (
        <div className="mb-5">
          <Notice>
            Sign-up is by invitation for now. If you were invited, use the email address your invitation was sent
            to. If not, ask for access below and we will email you when there is a place.
          </Notice>
        </div>
      )}
      <SignUpChoices siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} google={env.GOOGLE_SIGN_IN} />
      <p className="mt-5 text-sm text-muted">
        By creating an account you agree to the <TextLink href={"/legal/terms" as Route}>terms of use</TextLink>.
        Read how we handle your data in the <TextLink href={"/legal/privacy" as Route}>privacy notice</TextLink>.
      </p>
      {open ? null : (
        <section aria-labelledby="request-access" className="mt-8 border-t border-hairline pt-6">
          <h2 id="request-access" className="text-lg font-semibold text-ink">
            Not invited yet? Ask for access
          </h2>
          <p className="mt-2 mb-4 text-[15px] leading-relaxed text-muted">
            Tell us who you are and what you would like to make. Clubs, schools and brands are all welcome.
          </p>
          <AccessRequestForm siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
        </section>
      )}
    </AuthCard>
  );
}
