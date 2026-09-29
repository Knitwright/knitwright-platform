"use client";

import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { switchBrandAction } from "@/lib/brands/actions";

type SwitchBrandButtonProps = Readonly<{ brandId: string; brandName: string }>;

export function SwitchBrandButton({ brandId, brandName }: SwitchBrandButtonProps) {
  const { form, submit, pending, summary } = useFormAction(switchBrandAction);

  return (
    <form ref={form} action={submit} className="flex items-center gap-3">
      {summary ? (
        <p role="alert" tabIndex={-1} data-form-summary className="text-sm text-warn">
          {summary}
        </p>
      ) : null}
      <input type="hidden" name="brandId" value={brandId} />
      <Button
        type="submit"
        variant="secondary"
        pending={pending}
        className="h-9 px-3 text-sm"
        aria-label={`Work in ${brandName}`}
      >
        Work in this brand
      </Button>
    </form>
  );
}
