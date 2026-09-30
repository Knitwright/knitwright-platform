import type { Metadata } from "next";
import Link from "next/link";
import { DeleteForm } from "@/components/deletion/DeleteForm";
import { deleteAccountAction } from "@/lib/deletion/actions";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { email, brands } = await requireMember();

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-wider text-muted">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Your account</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Signed in as {email}. Read how your data is handled in the{" "}
          <Link href="/legal/privacy" className="underline">
            privacy notice
          </Link>
          .
        </p>
      </header>

      <section
        aria-labelledby="delete-account"
        className="rounded-2xl border border-hairline bg-surface p-6"
      >
        <h2 id="delete-account" className="text-base font-semibold text-ink">
          Delete your account
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          This deletes your account and your {brands.length === 1 ? "brand" : `${brands.length} brands`}{" "}
          with every design, version, uploaded picture and download record in them. It cannot be
          undone. Download any tech packs you want to keep first.
        </p>
        <div className="mt-4">
          <DeleteForm
            action={deleteAccountAction}
            submitLabel="Delete my account"
            busyLabel="Deleting"
          />
        </div>
      </section>
    </div>
  );
}
