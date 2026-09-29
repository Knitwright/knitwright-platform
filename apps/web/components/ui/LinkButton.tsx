import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

type LinkButtonProps = Readonly<{
  href: Route;
  children: ReactNode;
  variant?: "primary" | "secondary";
}>;

const BASE =
  "inline-flex h-11 items-center justify-center rounded-lg px-5 text-[15px] font-semibold transition-colors";

const VARIANTS = {
  primary: "bg-cobalt text-white hover:bg-[#2238c8]",
  secondary: "border border-hairline bg-surface text-ink hover:bg-shell",
} as const;

/** A link that looks like a button, for moving to another page. */
export function LinkButton({ href, children, variant = "primary" }: LinkButtonProps) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]}`}>
      {children}
    </Link>
  );
}
