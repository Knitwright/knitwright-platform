"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { useTemplateAction } from "@/lib/templates/actions";

/** The button under one template. It sends only the template's id; the server makes the copy in the member's own brand. */
export function UseTemplate({ templateId, title }: Readonly<{ templateId: string; title: string }>) {
  const { form, submit, pending, summary } = useFormAction(useTemplateAction);
  return (
    <form ref={form} action={submit} className="flex flex-col gap-2">
      <FormSummary message={summary} />
      <input type="hidden" name="templateId" value={templateId} />
      <Button type="submit" pending={pending} aria-label={`Use this template: ${title}`}>
        {pending ? "Making your copy" : "Use this template"}
      </Button>
    </form>
  );
}
