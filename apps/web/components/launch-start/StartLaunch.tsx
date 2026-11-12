"use client";

import type { ReactNode } from "react";
import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { startLaunchAction } from "@/lib/launch-start/actions";
import type { LaunchSource } from "@/lib/launch-start/plan";

type StartLaunchProps = Readonly<{
  source: LaunchSource;
  slug?: string | null;
  designProjectId?: string | null;
  colourwayId?: string | null;
  /** What the button says. */
  children: ReactNode;
  /** The button's full name for a screen reader, such as "Use template: Matchday". */
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  /** A rounded pill, as under a template card. */
  pill?: boolean;
  className?: string;
}>;

/**
 * A button that opens a new launch canvas from a dashboard page (decision 0140). It sends only what
 * the canvas starts from; the server makes the canvas in the member's own brand, puts the boards
 * on it and opens it. A refusal is said beside the button, never only in a toast (10 §9).
 */
export function StartLaunch({ source, slug, designProjectId, colourwayId, children, label, variant = "secondary", size = "sm", icon, pill = false, className }: StartLaunchProps) {
  const { form, submit, pending, summary } = useFormAction(startLaunchAction);
  return (
    <form ref={form} action={submit} className={className}>
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="slug" value={slug ?? ""} />
      <input type="hidden" name="designProjectId" value={designProjectId ?? ""} />
      <input type="hidden" name="colourwayId" value={colourwayId ?? ""} />
      <Button type="submit" variant={variant} size={size} icon={icon} pending={pending} aria-label={label} className={pill ? "w-full rounded-full!" : "w-full"}>
        {children}
      </Button>
      <FormSummary message={summary} />
    </form>
  );
}
