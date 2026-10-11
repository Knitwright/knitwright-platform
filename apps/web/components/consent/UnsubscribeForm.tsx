"use client";

import { FormDone, FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { unsubscribeAction } from "@/lib/consent/actions";

/**
 * The link in a marketing email opens this. Nothing changes until the button is pressed, so a
 * mail scanner that opens links cannot unsubscribe anyone, or be mistaken for the person.
 */
export function UnsubscribeForm({ token }: Readonly<{ token: string }>) {
  const { form, state, submit, pending, summary } = useFormAction(unsubscribeAction);

  if (state.result?.success) {
    return (
      <FormDone>
        <strong className="font-semibold">Done.</strong> You will get no more emails from us about new
        templates, season deadlines and offers. You can change this in Settings at any time.
      </FormDone>
    );
  }

  return (
    <form ref={form} action={submit} className="flex flex-col gap-4">
      <FormSummary message={summary} />
      <input type="hidden" name="token" value={token} />
      <Button type="submit" pending={pending}>
        {pending ? "One moment" : "Stop these emails"}
      </Button>
    </form>
  );
}
