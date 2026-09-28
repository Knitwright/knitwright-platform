import type { Metadata } from "next";
import { connection } from "next/server";
import { AuthCard, TextLink } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { getEnv } from "@/lib/config/env";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage() {
  // Settings are read when the page is asked for, never when the app is built.
  await connection();

  return (
    <AuthCard
      title="Reset your password"
      lead="Enter your email and we will send you a link to choose a new password."
      footer={
        <>
          Remembered it? <TextLink href="/sign-in">Sign in</TextLink>
        </>
      }
    >
      <ForgotPasswordForm siteKey={getEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
    </AuthCard>
  );
}
