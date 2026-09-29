import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { BrandNameForm } from "@/components/brands/BrandNameForm";
import { createBrandAction } from "@/lib/brands/actions";
import { HOME_AFTER_SIGN_IN } from "@/lib/server/core/paths";
import { currentBrands } from "@/lib/server/deps";
import { requireSession } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Name your brand" };

/** The first page a new user sees. Everything they make belongs to a brand. */
export default async function WelcomePage() {
  await requireSession();
  if ((await currentBrands()).length > 0) redirect(HOME_AFTER_SIGN_IN);

  return (
    <AuthCard
      title="Name your brand"
      lead="Your designs, files and tech packs belong to a brand. Only its members can see them."
    >
      <BrandNameForm
        action={createBrandAction}
        label="Brand name"
        hint="You can change it later."
        submitLabel="Create brand"
        busyLabel="Creating"
      />
    </AuthCard>
  );
}
