import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { WelcomeForm } from "@/components/brands/WelcomeForm";
import { PRODUCT } from "@/lib/config/product";
import { countryOptions } from "@/lib/leads/organisation";
import { HOME_AFTER_SIGN_IN } from "@/lib/server/core/paths";
import { currentBrands } from "@/lib/server/deps";
import { requireSession } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Who are you designing for?" };

/**
 * The first page a new user sees. It asks who they design for, then a name worded for that.
 * Everything they make belongs to a brand underneath, whatever the page calls it.
 */
export default async function WelcomePage() {
  await requireSession();
  if ((await currentBrands()).length > 0) redirect(HOME_AFTER_SIGN_IN);

  return (
    <AuthCard
      title={`Welcome to ${PRODUCT.name}`}
      lead="Your designs, files and tech packs are kept together here. Only the people you invite can see them."
    >
      <WelcomeForm countries={countryOptions()} />
    </AuthCard>
  );
}
