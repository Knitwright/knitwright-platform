import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonInner, buttonClasses } from "./Button";

type LinkButtonProps = Readonly<{
  href: Route;
  children: ReactNode;
  variant?: "primary" | "secondary";
  /** Adds the turning arrow disc of the homepage call to action. Primary links only. */
  arrow?: boolean;
}>;

/** A link that looks like a button, for moving to another page. */
export function LinkButton({ href, children, variant = "primary", arrow = false }: LinkButtonProps) {
  return (
    <Link href={href} className={buttonClasses(variant, arrow)}>
      <ButtonInner variant={variant} arrow={arrow}>
        {children}
      </ButtonInner>
    </Link>
  );
}
