import Link from "next/link";
import { pageFrame } from "@/components/shell/page-width";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

/**
 * The frame of the ops console (decision 0043). Platform admins only, and so is every page inside it: the
 * framework does not run a layout again when the user moves between its pages. Nothing public links here.
 */
export default async function OpsLayout({ children }: LayoutProps<"/">) {
  await requirePlatformAdmin();
  return (
    <>
      <header className="border-b border-hairline">
        <nav aria-label="Ops" className={`${pageFrame("content")} flex flex-wrap items-center gap-x-6 gap-y-2 py-3 text-sm`}>
          <span className="font-mono text-xs uppercase tracking-wider text-muted">Knitwright ops</span>
          <Link href="/ops" className="font-medium text-ink hover:underline">Batches</Link>
          <Link href="/ops/settings" className="font-medium text-ink hover:underline">Settings</Link>
        </nav>
      </header>
      <div className={`${pageFrame("content")} flex-1 py-8`}>{children}</div>
    </>
  );
}
