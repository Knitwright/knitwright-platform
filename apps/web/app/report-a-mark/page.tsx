import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { getEnv } from "@/lib/config/env";
import { ReportForm } from "./ReportForm";

export const metadata: Metadata = { title: "Report a trademark or copyright" };

/**
 * The public rights-holder report (F-G1, decision 0073). Anyone may report, with no account; the bot check and a limit per
 * address guard it (lib/moderation/actions.ts). The page shows no data.
 */
export default async function ReportMarkPage() {
  const env = getEnv();
  return (
    <AuthCard
      title="Report a trademark or copyright"
      lead="If something made on Knitwright uses your logo, brand name or artwork without permission, tell us. A person reads every report."
    >
      <ReportForm siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
    </AuthCard>
  );
}
