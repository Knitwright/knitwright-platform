import type { Metadata, Route } from "next";
import { AuthCard, TextLink } from "@/components/auth/AuthCard";
import { SignUpChoices } from "@/components/auth/SignUpChoices";
import { Notice } from "@/components/ui/Notice";
import { isSignupOpen } from "@/lib/auth/queries";
import { getEnv } from "@/lib/config/env";
import { PRODUCT } from "@/lib/config/product";
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
            {PRODUCT.name} is not open to new accounts yet. If you were invited, use the email
            address your invitation was sent to.
          </Notice>
        </div>
      )}
      <SignUpChoices siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} google={env.GOOGLE_SIGN_IN} />
      <p className="mt-5 text-sm text-muted">
        By creating an account you agree to the <TextLink href={"/legal/terms" as Route}>terms of use</TextLink>.
        Read how we handle your data in the <TextLink href={"/legal/privacy" as Route}>privacy notice</TextLink>.
      </p>
    </AuthCard>
  );
}
