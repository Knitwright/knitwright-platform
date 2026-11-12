import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonInner, buttonClasses, type ButtonSize, type ButtonVariant } from "./Button";

type LinkButtonProps = Readonly<{
  href: Route;
  children: ReactNode;
  variant?: Exclude<ButtonVariant, "quiet">;
  size?: ButtonSize;
  icon?: ReactNode;
  /** A trailing arrow disc. Primary links only. */
  arrow?: boolean;
  className?: string;
}>;

/** A link that looks like a button, for moving to another page. */
export function LinkButton({ href, children, variant = "primary", size = "md", icon, arrow = false, className = "" }: LinkButtonProps) {
  return (
    <Link href={href} className={buttonClasses(variant, arrow, `no-underline ${className}`, size)}>
      <ButtonInner variant={variant} arrow={arrow} icon={icon}>
        {children}
      </ButtonInner>
    </Link>
  );
}
