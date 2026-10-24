import { BalanceChip } from "@/components/credits/BalanceChip";
import { PageRise } from "@/components/shell/PageRise";
import { StudioHeader } from "@/components/shell/StudioHeader";
import { pageFrame } from "@/components/shell/page-width";
import { requireMember } from "@/lib/server/page-guards";

/**
 * The frame of the studio. It checks the session and the brand, and so does every
 * page inside it: the framework does not run this layout again when the user moves
 * from one of those pages to another.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { email, brand } = await requireMember();

  return (
    <>
      <StudioHeader email={email} brandName={brand.name} credits={<BalanceChip brandId={brand.id} />} />
      <main id="main" className={`${pageFrame("content")} flex-1 py-10`}>
        <PageRise>{children}</PageRise>
      </main>
    </>
  );
}
