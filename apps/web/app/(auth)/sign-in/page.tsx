import type { Metadata } from "next";
import { AuthCard, TextLink } from "@/components/auth/AuthCard";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";
import { SignInForm } from "@/components/auth/SignInForm";
import { Notice } from "@/components/ui/Notice";
import { noticeFor } from "@/lib/auth/notices";
import { getEnv } from "@/lib/config/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const env = getEnv();
  const notice = noticeFor((await searchParams).notice);

  return (
    <AuthCard
      title="Sign in"
      lead="Open your studio to work on your designs."
      footer={
        <>
          New here? <TextLink href="/sign-up">Create an account</TextLink>
        </>
      }
    >
      {notice ? (
        <div className="mb-5">
          <Notice tone={notice.tone} role="alert">
            {notice.text}
          </Notice>
        </div>
      ) : null}
      {env.GOOGLE_SIGN_IN ? (
        <>
          <GoogleButton />
          <OrDivider />
        </>
      ) : null}
      <SignInForm siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
      <p className="mt-5 text-sm text-muted">
        <TextLink href="/forgot-password">Forgot your password?</TextLink>
      </p>
    </AuthCard>
  );
}
