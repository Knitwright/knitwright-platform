"use client";

import { Button } from "@/components/ui/Button";
import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { applyKitStyleAction } from "@/lib/kit-styles/actions";
import type { GalleryFrom } from "@/lib/kit-styles/address";
import type { ClubColours } from "@/lib/kit-styles/presets";

type PickProps = Readonly<{
  projectId: string;
  version: number;
  styleId: string;
  label: string;
  colours: ClubColours;
  from: GalleryFrom;
  current: boolean;
}>;

/** The button under one tile. It sends only the style and the colours; the server works out the changes. */
export function KitStylePick({ projectId, version, styleId, label, colours, from, current }: PickProps) {
  const { form, submit, pending, summary } = useFormAction(applyKitStyleAction);
  return (
    <form ref={form} action={submit} className="flex flex-col gap-2">
      <FormSummary message={summary} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="styleId" value={styleId} />
      <input type="hidden" name="main" value={colours.main} />
      <input type="hidden" name="second" value={colours.second} />
      <input type="hidden" name="third" value={colours.third ?? ""} />
      <input type="hidden" name="from" value={from} />
      <Button type="submit" variant={current ? "secondary" : "primary"} pending={pending} aria-label={`Use ${label}`}>
        {pending ? "Saving" : current ? "Use again" : "Use this style"}
      </Button>
    </form>
  );
}
