"use client";

import type { ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

/**
 * A button that is visible but cannot act yet, with a tooltip saying why (10 §8 "disabled"). The tooltip reads its
 * trigger's props, which only a client component can hand it, so a server page uses this instead of a Button with
 * `disabledReason` directly.
 */
export function LockedButton({ reason, icon, variant = "secondary", size = "md", children }: Readonly<{ reason: string; icon?: ReactNode; variant?: ButtonVariant; size?: ButtonSize; children: ReactNode }>) {
  return (
    <Button variant={variant} size={size} icon={icon} disabledReason={reason}>
      {children}
    </Button>
  );
}
