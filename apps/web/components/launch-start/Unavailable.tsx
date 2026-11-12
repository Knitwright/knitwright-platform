"use client";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

/**
 * A button shown disabled with the reason in a tooltip (10 §8, §9: never hide the feature). It is
 * a client component on purpose: the tooltip reads its button's own props, which a button drawn by
 * a server component does not hand over.
 */
export function Unavailable({
  children,
  reason,
  label,
  variant = "secondary",
  size = "sm",
  className,
}: Readonly<{ children: string; reason: string; label: string; variant?: ButtonVariant; size?: ButtonSize; className?: string }>) {
  return (
    <Button variant={variant} size={size} disabledReason={reason} aria-label={label} className={className}>
      {children}
    </Button>
  );
}
