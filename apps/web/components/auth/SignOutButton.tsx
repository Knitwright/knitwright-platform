"use client";

import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/lib/auth/actions";

export function SignOutButton() {
  const { form, submit, pending, summary } = useFormAction(signOutAction);

  return (
    <form ref={form} action={submit} className="flex items-center gap-3">
      {summary ? (
        <p role="alert" tabIndex={-1} data-form-summary className="text-sm text-warn">
          {summary}
        </p>
      ) : null}
      <Button type="submit" variant="quiet" pending={pending} className="h-9 px-3 text-sm">
        Sign out
      </Button>
    </form>
  );
}
