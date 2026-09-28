"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { confirmLinkAction } from "@/lib/auth/actions";
import type { ConfirmLink } from "@/lib/auth/schemas";

type ConfirmLinkFormProps = Readonly<{ link: ConfirmLink }>;

/**
 * The link in an email opens this form. The token is used only when the button is
 * pressed, so a mail scanner that opens links cannot use it up first.
 */
export function ConfirmLinkForm({ link }: ConfirmLinkFormProps) {
  const { form, submit, pending, summary } = useFormAction(confirmLinkAction);

  return (
    <form ref={form} action={submit} className="flex flex-col gap-4">
      <FormSummary message={summary} />
      <input type="hidden" name="token_hash" value={link.token_hash} />
      <input type="hidden" name="type" value={link.type} />
      <Button type="submit" pending={pending}>
        {pending ? "One moment" : "Continue"}
      </Button>
    </form>
  );
}
