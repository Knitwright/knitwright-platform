import type { Metadata } from "next";
import { AuthCard, TextLink } from "@/components/auth/AuthCard";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";
import { SignUpForm } from "@/components/auth/SignUpForm";
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
      {env.GOOGLE_SIGN_IN ? (
        <>
          <GoogleButton />
          <OrDivider />
        </>
      ) : null}
      <SignUpForm siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
    </AuthCard>
  );
}
