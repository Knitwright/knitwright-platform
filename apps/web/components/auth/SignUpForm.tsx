"use client";

import { signUpAction } from "@/lib/auth/actions";
import { MARKETING_FIELD } from "@/lib/consent/schemas";
import { EmailLinkForm } from "./EmailLinkForm";

/** `marketing` is the state of the box on the sign-up page, shared with the Google button. */
export function SignUpForm({ siteKey, marketing }: Readonly<{ siteKey: string; marketing: boolean }>) {
  return (
    <EmailLinkForm
      action={signUpAction}
      siteKey={siteKey}
      emailLabel="Work email"
      submitLabel="Send me a link"
      busyLabel="Sending"
      extraFields={marketing ? <input type="hidden" name={MARKETING_FIELD} value="yes" /> : null}
      done={(email) => (
        <>
          <strong className="font-semibold">Check your email.</strong> If {email} can have an
          account, a link is on its way. Open it to confirm your address and choose a password.
        </>
      )}
    />
  );
}
