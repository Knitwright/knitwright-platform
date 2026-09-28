"use client";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { startGoogleSignInAction } from "@/lib/auth/actions";
import { useFormAction } from "./useFormAction";

export function GoogleButton() {
  const { submit, pending, failure } = useFormAction(startGoogleSignInAction);

  return (
    <form action={submit} className="flex flex-col gap-3">
      {failure ? (
        <Notice tone="warn" role="alert">
          {failure.message}
        </Notice>
      ) : null}
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
