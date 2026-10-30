"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { setShareLinkAudienceAction } from "@/lib/share/actions";
import type { ShareLinkView } from "@/lib/share/responses";

/**
 * Who may open a design through its link (spec F-S4 Share): "Only invited people" or "Anyone with
 * the link can view". A link set to "Only invited people" opens nothing at all on its own, which
 * the database decides, not the page.
 */
export function LinkAudience({ projectId, link }: Readonly<{ projectId: string; link: ShareLinkView }>) {
  const { form, submit, pending, summary } = useFormAction<unknown>(setShareLinkAudienceAction);
  return (
    <div className="flex flex-col gap-2" data-testid="share-link-audience" data-audience={link.audience}>
      <p className="text-sm font-medium text-ink">{link.audienceLabel}</p>
      <p className="text-sm text-muted">{link.audienceNote}</p>
      <form ref={form} action={submit} className="flex flex-col gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="linkId" value={link.id} />
        <input type="hidden" name="audience" value={link.otherAudience} />
        <Button type="submit" variant="secondary" pending={pending}>
          {pending ? "Changing" : `Change to ${link.otherAudienceLabel.toLowerCase()}`}
        </Button>
        <FormSummary message={summary} />
      </form>
    </div>
  );
}
