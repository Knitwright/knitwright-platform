"use client";

import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/lib/auth/actions";
import { useFormAction } from "./useFormAction";

export function SignOutButton() {
  const { submit, pending } = useFormAction(signOutAction);

  return (
    <form action={submit}>
      <Button type="submit" variant="quiet" pending={pending} className="h-9 px-3 text-sm">
        Sign out
      </Button>
    </form>
  );
}
