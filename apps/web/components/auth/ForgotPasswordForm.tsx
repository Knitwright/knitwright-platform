"use client";

import { requestPasswordResetAction } from "@/lib/auth/actions";
import { EmailLinkForm } from "./EmailLinkForm";

export function ForgotPasswordForm({ siteKey }: Readonly<{ siteKey: string }>) {
  return (
    <EmailLinkForm
      action={requestPasswordResetAction}
      siteKey={siteKey}
      emailLabel="Email"
      submitLabel="Send reset link"
      busyLabel="Sending"
      done={(email) => (
        <>
          <strong className="font-semibold">Check your email.</strong> If {email} has an account,
          a link to choose a new password is on its way.
        </>
      )}
    />
  );
}
