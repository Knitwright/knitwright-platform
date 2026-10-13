import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/Logo";
import { PRODUCT } from "@/lib/config/product";

type AuthCardProps = Readonly<{
  title: string;
  lead?: string;
  children: ReactNode;
  footer?: ReactNode;
}>;

/** The frame every sign-in page shares: a glass card with the thread ring, over the aurora. */
export function AuthCard({ title, lead, children, footer }: AuthCardProps) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-12">
      <Link href="/" className="rise flex items-center gap-2.5 self-start rounded-full text-white">
        <BrandMark />
        <span className="text-[19px] font-medium tracking-[-0.02em]">{PRODUCT.name}</span>
      </Link>
      <div className="glass thread-ring rise mt-8 rounded-[2rem] p-7 sm:p-8" style={{ "--i": 1 } as React.CSSProperties}>
        <h1 className="text-[1.75rem] font-medium leading-tight tracking-[-0.03em] text-ink">{title}</h1>
        {lead ? <p className="mt-2 text-[15px] leading-relaxed text-muted">{lead}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
    </main>
  );
}

export function TextLink({ href, children }: Readonly<{ href: Route; children: ReactNode }>) {
  return (
    <Link
      href={href}
      className="font-medium text-cobalt-soft underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}
