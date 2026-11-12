"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { useTemplateAction } from "@/lib/templates/actions";

/**
 * The "Use template" pill of a design template. It sends only the template's id, and the server
 * makes the copy in the member's own brand and opens the editor on it at version 1, exactly as the
 * v2.2 library's button did (`../UseTemplate.tsx`). Its name keeps the template's title, so a
 * screen reader hears which one.
 */
export function UseDesignTemplate({ templateId, title }: Readonly<{ templateId: string; title: string }>) {
  const { form, submit, pending, summary } = useFormAction(useTemplateAction);
  return (
    <form ref={form} action={submit} className="flex flex-col gap-2">
      <input type="hidden" name="templateId" value={templateId} />
      <Button type="submit" variant="secondary" size="sm" pending={pending} aria-label={`Use this template: ${title}`} className="w-full rounded-full!">
        {pending ? "Making your copy" : "Use template"}
      </Button>
      <FormSummary message={summary} />
    </form>
  );
}
