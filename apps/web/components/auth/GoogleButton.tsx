"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { startGoogleSignInAction } from "@/lib/auth/actions";

export function GoogleButton() {
  const { form, submit, pending, summary } = useFormAction(startGoogleSignInAction);

  return (
    <form ref={form} action={submit} className="flex flex-col gap-3">
      <FormSummary message={summary} />
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
