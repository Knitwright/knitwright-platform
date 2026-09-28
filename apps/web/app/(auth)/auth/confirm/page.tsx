import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { ConfirmLinkForm } from "@/components/auth/ConfirmLinkForm";
import { confirmLinkSchema } from "@/lib/auth/schemas";

export const metadata: Metadata = {
  title: "Confirm",
  // The address holds a one-time token. Keep it out of search results and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const COPY = {
  email: {
    title: "Confirm your email",
    lead: "Press the button to confirm your address and open your studio.",
  },
  recovery: {
    title: "Reset your password",
    lead: "Press the button to continue. You will choose a new password next.",
  },
} as const;

export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const link = confirmLinkSchema.safeParse(await searchParams);
  if (!link.success) redirect("/sign-in?notice=link-missing");

  const copy = COPY[link.data.type];
  return (
    <AuthCard title={copy.title} lead={copy.lead}>
      <ConfirmLinkForm link={link.data} />
    </AuthCard>
  );
}
