import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Page not found</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        There is nothing at this address. It may have been moved, or the link may be wrong.
      </p>
      <p className="mt-6">
        <Link href="/" className="font-medium text-cobalt underline-offset-4 hover:underline">
          Go to the start page
        </Link>
      </p>
    </main>
  );
}
