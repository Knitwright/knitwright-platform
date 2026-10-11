"use client";

import { useState } from "react";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { MARKETING_OPT_IN } from "@/lib/consent/wording";
import { GoogleButton, OrDivider } from "./GoogleButton";
import { SignUpForm } from "./SignUpForm";

/**
 * The ways to sign up, and the one marketing box both of them send. The box starts unticked
 * and is never ticked for the person (Spam Act 2003; decision 0025).
 */
export function SignUpChoices({ siteKey, google }: Readonly<{ siteKey: string; google: boolean }>) {
  const [marketing, setMarketing] = useState(false);

  return (
    <div className="flex flex-col">
      <div className="mb-5">
        <CheckboxField
          label={MARKETING_OPT_IN.text}
          checked={marketing}
          onChange={(event) => setMarketing(event.target.checked)}
        />
      </div>
      {google ? (
        <>
          <GoogleButton marketing={marketing} />
          <OrDivider />
        </>
      ) : null}
      <SignUpForm siteKey={siteKey} marketing={marketing} />
    </div>
  );
}
