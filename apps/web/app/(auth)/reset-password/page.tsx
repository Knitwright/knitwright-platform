import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { requireSession } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Choose a password" };

export default async function ResetPasswordPage() {
  // A link from an email signs the user in. Without a session there is nothing to change.
  await requireSession();

  return (
    <AuthCard title="Choose a password" lead="You will use it the next time you sign in.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
