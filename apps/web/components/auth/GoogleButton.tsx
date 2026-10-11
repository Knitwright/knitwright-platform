"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { startGoogleSignInAction } from "@/lib/auth/actions";
import { MARKETING_FIELD } from "@/lib/consent/schemas";

/**
 * `marketing` is the state of the sign-up page's marketing box. The sign-in page asks
 * nothing, so it leaves it out and no choice is sent.
 */
export function GoogleButton({ marketing }: Readonly<{ marketing?: boolean }>) {
  const { form, submit, pending, summary } = useFormAction(startGoogleSignInAction);

  return (
    <form ref={form} action={submit} className="flex flex-col gap-3">
      <FormSummary message={summary} />
      {marketing === undefined ? null : <input type="hidden" name={MARKETING_FIELD} value={marketing ? "yes" : "no"} />}
      <Button type="submit" variant="secondary" pending={pending}>
        Continue with Google
      </Button>
    </form>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-faint">
      <span className="h-px flex-1 bg-hairline" />
      or
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}
