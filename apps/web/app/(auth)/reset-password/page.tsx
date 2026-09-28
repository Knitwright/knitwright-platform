import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { SIGN_IN_PATH } from "@/lib/server/core/paths";
import { currentSession } from "@/lib/server/deps";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // The reset link signs the user in. Without a session there is nothing to change.
  if (!(await currentSession())) redirect(SIGN_IN_PATH);

  return (
    <AuthCard title="Choose a new password" lead="You will use it the next time you sign in.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
