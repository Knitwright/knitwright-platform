"use client";

import { signUpAction } from "@/lib/auth/actions";
import { EmailLinkForm } from "./EmailLinkForm";

export function SignUpForm({ siteKey }: Readonly<{ siteKey: string }>) {
  return (
    <EmailLinkForm
      action={signUpAction}
      siteKey={siteKey}
      emailLabel="Work email"
      submitLabel="Send me a link"
      busyLabel="Sending"
      done={(email) => (
        <>
          <strong className="font-semibold">Check your email.</strong> If {email} can have an
          account, a link is on its way. Open it to confirm your address and choose a password.
        </>
      )}
    />
  );
}
