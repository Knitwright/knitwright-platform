import { StudioHeader } from "@/components/shell/StudioHeader";
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
      <StudioHeader email={email} brandName={brand.name} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">
        {children}
      </main>
    </>
  );
}
