"use client";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { confirmLinkAction } from "@/lib/auth/actions";
import type { ConfirmLink } from "@/lib/auth/schemas";
import { useFormAction } from "./useFormAction";

type ConfirmLinkFormProps = Readonly<{ link: ConfirmLink }>;

const LABELS: Readonly<Record<ConfirmLink["type"], { idle: string; busy: string }>> = {
  email: { idle: "Confirm email", busy: "Confirming" },
  recovery: { idle: "Continue", busy: "Checking the link" },
};

/**
 * The link in an email opens this form. The token is used only when the button is
 * pressed, so a mail scanner that opens links cannot use it up first.
 */
export function ConfirmLinkForm({ link }: ConfirmLinkFormProps) {
  const { submit, pending, failure } = useFormAction(confirmLinkAction);
  const label = LABELS[link.type];

  return (
    <form action={submit} className="flex flex-col gap-4">
      {failure ? (
        <Notice tone="warn" role="alert">
          {failure.message}
        </Notice>
      ) : null}
      <input type="hidden" name="token_hash" value={link.token_hash} />
      <input type="hidden" name="type" value={link.type} />
      <Button type="submit" pending={pending}>
        {pending ? label.busy : label.idle}
      </Button>
    </form>
  );
}
