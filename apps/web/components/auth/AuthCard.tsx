import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

type AuthCardProps = Readonly<{
  title: string;
  lead?: string;
  children: ReactNode;
  footer?: ReactNode;
}>;

/** The frame every sign-in page shares. */
export function AuthCard({ title, lead, children, footer }: AuthCardProps) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-12">
      <Link href="/" className="self-start rounded-md">
        <Logo />
      </Link>
      <div className="mt-8 rounded-2xl border border-hairline bg-surface p-7">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {lead ? <p className="mt-2 text-[15px] leading-relaxed text-muted">{lead}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
    </main>
  );
}

export function TextLink({ href, children }: Readonly<{ href: string; children: ReactNode }>) {
  return (
    <Link
      href={href as never}
      className="font-medium text-cobalt underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}
